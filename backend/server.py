"""
BarbeariaShop - Backend
FastAPI + MongoDB + JWT Authentication
"""
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone, date
from typing import Optional, List, Annotated, Literal
from contextlib import asynccontextmanager
from enum import Enum

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "barbearia_shop")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "1440"))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@barbearia.com").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@12345")

logger = logging.getLogger("barbearia")
logging.basicConfig(level=logging.INFO)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
users_col = db.users
barbeiros_col = db.barbeiros
servicos_col = db.servicos
produtos_col = db.produtos
agendamentos_col = db.agendamentos

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---------- Enums & Models ----------
class Role(str, Enum):
    cliente = "cliente"
    barbeiro = "barbeiro"
    admin = "admin"


class AgendamentoStatus(str, Enum):
    pendente = "Pendente"
    confirmado = "Confirmado"
    realizado = "Realizado"
    cancelado = "Cancelado"


class RegisterIn(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    telefone: Optional[str] = None
    cpf: Optional[str] = None


class UserOut(BaseModel):
    id: str
    nome: str
    email: EmailStr
    role: Role
    telefone: Optional[str] = None
    cpf: Optional[str] = None
    barbeiro_id: Optional[str] = None
    active: bool = True
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class BarbeiroIn(BaseModel):
    nome: str
    especialidade: str = ""
    telefone: str = ""
    foto_url: str = ""
    bio: str = ""
    status: Literal["Ativo", "Inativo"] = "Ativo"
    galeria: List[str] = []
    user_id: Optional[str] = None  # link to user account


class BarbeiroOut(BarbeiroIn):
    id: str
    created_at: datetime


class ServicoIn(BaseModel):
    nome: str = Field(min_length=1)
    descricao: str = ""
    preco: float = Field(ge=0)
    duracao_minutos: int = Field(default=30, ge=5, le=480)
    imagem_url: str = ""


class ServicoOut(ServicoIn):
    id: str
    created_at: datetime


class ProdutoIn(BaseModel):
    nome: str = Field(min_length=1)
    descricao: str = ""
    preco: float = Field(ge=0)
    estoque: int = Field(default=0, ge=0)
    imagem_url: str = ""


class ProdutoOut(ProdutoIn):
    id: str
    created_at: datetime


class AgendamentoIn(BaseModel):
    barbeiro_id: str
    servico_id: str
    data: str  # YYYY-MM-DD
    horario: str  # HH:MM
    observacao: str = ""


class AgendamentoOut(BaseModel):
    id: str
    cliente_id: str
    cliente_nome: str
    barbeiro_id: str
    barbeiro_nome: str
    servico_id: str
    servico_nome: str
    servico_preco: float
    duracao_minutos: int = 30
    data: str
    horario: str
    status: AgendamentoStatus
    observacao: str = ""
    created_at: datetime


class StatusUpdate(BaseModel):
    status: AgendamentoStatus


# ---------- Auth helpers ----------
DUMMY_HASH = bcrypt.hashpw(b"dummy", bcrypt.gensalt()).decode()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), stored.encode())
    except Exception:
        return False


def make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user["id"],
            "role": user["role"],
            "iat": now,
            "exp": now + timedelta(minutes=TOKEN_MINUTES),
            "jti": str(uuid.uuid4()),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def public_user(u: dict) -> UserOut:
    return UserOut(
        id=u["id"],
        nome=u["nome"],
        email=u["email"],
        role=u["role"],
        telefone=u.get("telefone"),
        cpf=u.get("cpf"),
        barbeiro_id=u.get("barbeiro_id"),
        active=u.get("active", True),
        created_at=u["created_at"],
    )


async def current_user(token: Annotated[str, Depends(oauth2)]) -> dict:
    cred_exc = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        uid = payload["sub"]
    except Exception:
        raise cred_exc
    u = await users_col.find_one({"id": uid}, {"_id": 0})
    if not u or not u.get("active", True):
        raise cred_exc
    return u


def require_roles(*allowed):
    async def dep(u: dict = Depends(current_user)):
        if u["role"] not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return u

    return dep


# ---------- Lifespan: indexes + seed ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await users_col.create_index("email", unique=True)
    await users_col.create_index("id", unique=True)
    await barbeiros_col.create_index("id", unique=True)
    await servicos_col.create_index("id", unique=True)
    await produtos_col.create_index("id", unique=True)
    await agendamentos_col.create_index("id", unique=True)
    try:
        await agendamentos_col.drop_index("barbeiro_id_1_data_1_horario_1")
    except Exception:
        pass
    # Race-safe uniqueness for active bookings (same start slot)
    await agendamentos_col.update_many(
        {"ativo": {"$exists": False}},
        [{"$set": {"ativo": {"$ne": ["$status", "Cancelado"]}}}],
    )
    await agendamentos_col.create_index(
        [("barbeiro_id", 1), ("data", 1), ("horario", 1)],
        unique=True,
        partialFilterExpression={"ativo": True},
        name="uniq_active_slot",
    )

    # Seed admin
    if not await users_col.find_one({"email": ADMIN_EMAIL}):
        await users_col.insert_one(
            {
                "id": str(uuid.uuid4()),
                "nome": "Administrador",
                "email": ADMIN_EMAIL,
                "password_hash": hash_password(ADMIN_PASSWORD),
                "role": Role.admin.value,
                "telefone": "",
                "cpf": "",
                "active": True,
                "created_at": datetime.now(timezone.utc),
            }
        )
        logger.info("Admin seeded: %s", ADMIN_EMAIL)

    # Seed sample servicos if empty
    if await servicos_col.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        samples = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Corte Masculino Clássico",
                "descricao": "Corte tradicional com tesoura e máquina, acabamento perfeito.",
                "preco": 45.0,
                "duracao_minutos": 30,
                "imagem_url": "https://images.unsplash.com/photo-1630827020718-3433092696e7?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Barba Completa",
                "descricao": "Modelagem de barba com toalha quente e óleo relaxante.",
                "preco": 35.0,
                "duracao_minutos": 30,
                "imagem_url": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Corte + Barba",
                "descricao": "Combo completo para o visual impecável.",
                "preco": 70.0,
                "duracao_minutos": 60,
                "imagem_url": "https://images.unsplash.com/photo-1647140655214-e4a2d914971f?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Degradê (Fade)",
                "descricao": "Corte moderno com degradê perfeito nas laterais.",
                "preco": 55.0,
                "duracao_minutos": 45,
                "imagem_url": "https://images.unsplash.com/photo-1599351431613-18ef1fdd27e1?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
                "created_at": now,
            },
        ]
        await servicos_col.insert_many(samples)
        logger.info("Seeded %d servicos", len(samples))

    # Seed sample barbeiros if empty
    if await barbeiros_col.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        barbeiros_sample = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Rafael Oliveira",
                "especialidade": "Especialista em degradê e barba",
                "telefone": "(11) 98888-1111",
                "foto_url": "https://images.unsplash.com/photo-1618077360395-f3068be8e001?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
                "bio": "Mais de 10 anos de experiência em cortes modernos e clássicos.",
                "status": "Ativo",
                "user_id": None,
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Marcos Silva",
                "especialidade": "Barbeiro mestre em cortes clássicos",
                "telefone": "(11) 98888-2222",
                "foto_url": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
                "bio": "Tradição e precisão em cada corte. Especialista em navalha.",
                "status": "Ativo",
                "user_id": None,
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "André Costa",
                "especialidade": "Especialista em barba e bigode",
                "telefone": "(11) 98888-3333",
                "foto_url": "https://images.unsplash.com/photo-1565464027194-7957a2295fb7?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
                "bio": "Mestre da modelagem de barba e cuidados masculinos.",
                "status": "Ativo",
                "user_id": None,
                "created_at": now,
            },
        ]
        await barbeiros_col.insert_many(barbeiros_sample)
        logger.info("Seeded %d barbeiros", len(barbeiros_sample))

    # Seed sample produtos
    if await produtos_col.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        produtos_sample = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Óleo para Barba Premium",
                "descricao": "Hidratação profunda e brilho natural para sua barba.",
                "preco": 49.90,
                "estoque": 20,
                "imagem_url": "https://images.unsplash.com/photo-1620018646973-e3e257a1002c?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Pomada Modeladora Matte",
                "descricao": "Fixação forte com acabamento fosco.",
                "preco": 39.90,
                "estoque": 35,
                "imagem_url": "https://images.unsplash.com/photo-1595425964377-ec7d7a5fcff5?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Shampoo Masculino",
                "descricao": "Limpeza profunda e revitalização capilar.",
                "preco": 32.00,
                "estoque": 15,
                "imagem_url": "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
                "created_at": now,
            },
        ]
        await produtos_col.insert_many(produtos_sample)
        logger.info("Seeded %d produtos", len(produtos_sample))

    # Fix broken sample images
    await produtos_col.update_many(
        {"imagem_url": {"$regex": "photo-1595425964377|photo-1570194065650"}, "nome": "Pomada Modeladora Matte"},
        {"$set": {"imagem_url": "https://images.unsplash.com/photo-1599351431613-18ef1fdd27e1?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"}},
    )
    await produtos_col.update_many(
        {"imagem_url": {"$regex": "photo-1570194065650"}},
        {"$set": {"imagem_url": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"}},
    )
    # Seed gallery for barbers without one
    await barbeiros_col.update_many(
        {"galeria": {"$exists": False}},
        {"$set": {"galeria": [
            "https://images.unsplash.com/photo-1630827020718-3433092696e7?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
            "https://images.unsplash.com/photo-1647140655214-e4a2d914971f?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
            "https://images.unsplash.com/photo-1621605815971-fbc98d665033?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
            "https://images.unsplash.com/photo-1599351431613-18ef1fdd27e1?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        ]}},
    )

    yield
    client.close()


app = FastAPI(title="BarbeariaShop API", lifespan=lifespan)


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")


# ---------- Auth routes ----------
@api.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(data: RegisterIn):
    email = data.email.lower().strip()
    if await users_col.find_one({"email": email}):
        raise HTTPException(409, "E-mail já cadastrado")
    user_doc = {
        "id": str(uuid.uuid4()),
        "nome": data.nome.strip(),
        "email": email,
        "password_hash": hash_password(data.password),
        "role": Role.cliente.value,
        "telefone": data.telefone or "",
        "cpf": data.cpf or "",
        "active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await users_col.insert_one(user_doc)
    return TokenOut(
        access_token=make_token(user_doc),
        expires_in=TOKEN_MINUTES * 60,
        user=public_user(user_doc),
    )


@api.post("/auth/login", response_model=TokenOut)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    email = form.username.lower().strip()
    u = await users_col.find_one({"email": email}, {"_id": 0})
    if not u:
        verify_password(form.password, DUMMY_HASH)
        raise HTTPException(401, "E-mail ou senha inválidos")
    if not u.get("active", True) or not verify_password(form.password, u["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return TokenOut(
        access_token=make_token(u),
        expires_in=TOKEN_MINUTES * 60,
        user=public_user(u),
    )


@api.get("/auth/me", response_model=UserOut)
async def me(u: dict = Depends(current_user)):
    return public_user(u)


# ---------- Barbeiros ----------
@api.get("/barbeiros", response_model=List[BarbeiroOut])
async def list_barbeiros():
    rows = await barbeiros_col.find({}, {"_id": 0}).to_list(500)
    return [BarbeiroOut(**r) for r in rows]


@api.get("/barbeiros/{barbeiro_id}", response_model=BarbeiroOut)
async def get_barbeiro(barbeiro_id: str):
    r = await barbeiros_col.find_one({"id": barbeiro_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Barbeiro não encontrado")
    return BarbeiroOut(**r)


@api.post("/barbeiros", response_model=BarbeiroOut, status_code=201)
async def create_barbeiro(data: BarbeiroIn, _: dict = Depends(require_roles("admin"))):
    doc = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc),
    }
    await barbeiros_col.insert_one(doc)
    doc.pop("_id", None)
    return BarbeiroOut(**doc)


@api.put("/barbeiros/{barbeiro_id}", response_model=BarbeiroOut)
async def update_barbeiro(
    barbeiro_id: str, data: BarbeiroIn, _: dict = Depends(require_roles("admin"))
):
    r = await barbeiros_col.find_one_and_update(
        {"id": barbeiro_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0},
    )
    if not r:
        raise HTTPException(404, "Barbeiro não encontrado")
    return BarbeiroOut(**r)


@api.delete("/barbeiros/{barbeiro_id}", status_code=204)
async def delete_barbeiro(barbeiro_id: str, _: dict = Depends(require_roles("admin"))):
    if await agendamentos_col.find_one({"barbeiro_id": barbeiro_id, "status": {"$in": ["Pendente", "Confirmado"]}}):
        raise HTTPException(409, "Barbeiro possui agendamentos ativos. Cancele-os ou marque-o como Inativo.")
    await users_col.update_many({"barbeiro_id": barbeiro_id}, {"$set": {"barbeiro_id": None, "role": "cliente"}})
    r = await barbeiros_col.delete_one({"id": barbeiro_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Barbeiro não encontrado")


# ---------- Serviços ----------
@api.get("/servicos", response_model=List[ServicoOut])
async def list_servicos():
    rows = await servicos_col.find({}, {"_id": 0}).to_list(500)
    return [ServicoOut(**r) for r in rows]


@api.post("/servicos", response_model=ServicoOut, status_code=201)
async def create_servico(data: ServicoIn, _: dict = Depends(require_roles("admin"))):
    doc = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc),
    }
    await servicos_col.insert_one(doc)
    doc.pop("_id", None)
    return ServicoOut(**doc)


@api.put("/servicos/{servico_id}", response_model=ServicoOut)
async def update_servico(
    servico_id: str, data: ServicoIn, _: dict = Depends(require_roles("admin"))
):
    r = await servicos_col.find_one_and_update(
        {"id": servico_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0},
    )
    if not r:
        raise HTTPException(404, "Serviço não encontrado")
    return ServicoOut(**r)


@api.delete("/servicos/{servico_id}", status_code=204)
async def delete_servico(servico_id: str, _: dict = Depends(require_roles("admin"))):
    if await agendamentos_col.find_one({"servico_id": servico_id, "status": {"$in": ["Pendente", "Confirmado"]}}):
        raise HTTPException(409, "Serviço possui agendamentos ativos")
    r = await servicos_col.delete_one({"id": servico_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Serviço não encontrado")


# ---------- Produtos ----------
@api.get("/produtos", response_model=List[ProdutoOut])
async def list_produtos():
    rows = await produtos_col.find({}, {"_id": 0}).to_list(500)
    return [ProdutoOut(**r) for r in rows]


@api.post("/produtos", response_model=ProdutoOut, status_code=201)
async def create_produto(data: ProdutoIn, _: dict = Depends(require_roles("admin"))):
    doc = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc),
    }
    await produtos_col.insert_one(doc)
    doc.pop("_id", None)
    return ProdutoOut(**doc)


@api.put("/produtos/{produto_id}", response_model=ProdutoOut)
async def update_produto(
    produto_id: str, data: ProdutoIn, _: dict = Depends(require_roles("admin"))
):
    r = await produtos_col.find_one_and_update(
        {"id": produto_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0},
    )
    if not r:
        raise HTTPException(404, "Produto não encontrado")
    return ProdutoOut(**r)


@api.delete("/produtos/{produto_id}", status_code=204)
async def delete_produto(produto_id: str, _: dict = Depends(require_roles("admin"))):
    r = await produtos_col.delete_one({"id": produto_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Produto não encontrado")


# ---------- Horários ----------
DEFAULT_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
]


SLOT_MIN = 30
LOCAL_TZ = ZoneInfo("America/Sao_Paulo")
FINAL_STATUSES = {AgendamentoStatus.realizado.value, AgendamentoStatus.cancelado.value}
ALLOWED_TRANSITIONS = {
    AgendamentoStatus.pendente.value: {"Confirmado", "Realizado", "Cancelado"},
    AgendamentoStatus.confirmado.value: {"Realizado", "Cancelado"},
    AgendamentoStatus.realizado.value: set(),
    AgendamentoStatus.cancelado.value: set(),
}


def slot_span(horario: str, duracao: int) -> List[str]:
    """Consecutive 30-min times covered by a booking; stops at gaps (e.g. lunch)."""
    n = max(1, -(-int(duracao or SLOT_MIN) // SLOT_MIN))
    if horario not in DEFAULT_SLOTS:
        return [horario]
    start = datetime.strptime(horario, "%H:%M")
    out = []
    for k in range(n):
        t = (start + timedelta(minutes=SLOT_MIN * k)).strftime("%H:%M")
        if t not in DEFAULT_SLOTS:
            break
        out.append(t)
    return out


def is_past(data_ag: str, horario: str) -> bool:
    dt = datetime.strptime(f"{data_ag} {horario}", "%Y-%m-%d %H:%M").replace(tzinfo=LOCAL_TZ)
    return dt <= datetime.now(LOCAL_TZ)


async def occupied_slots(barbeiro_id: str, data_ag: str, exclude_id: Optional[str] = None) -> set:
    occ: set = set()
    q = {
        "barbeiro_id": barbeiro_id,
        "data": data_ag,
        "status": {"$nin": [AgendamentoStatus.cancelado.value]},
    }
    async for a in agendamentos_col.find(q, {"_id": 0}):
        if exclude_id and a["id"] == exclude_id:
            continue
        occ.update(slot_span(a["horario"], a.get("duracao_minutos", SLOT_MIN)))
    return occ


@api.get("/horarios")
async def horarios_disponiveis(
    barbeiro_id: str = Query(...),
    data_ag: str = Query(..., alias="data"),
    servico_id: Optional[str] = Query(None),
):
    """Returns list of {horario, disponivel} for the given barber and date."""
    dur = SLOT_MIN
    if servico_id:
        s = await servicos_col.find_one({"id": servico_id}, {"_id": 0})
        if s:
            dur = int(s.get("duracao_minutos") or SLOT_MIN)
    occ = await occupied_slots(barbeiro_id, data_ag)
    out = []
    for h in DEFAULT_SLOTS:
        span = slot_span(h, dur)
        fits = len(span) == max(1, -(-dur // SLOT_MIN))
        ok = fits and not (set(span) & occ) and not is_past(data_ag, h)
        out.append({"horario": h, "disponivel": ok})
    return out


# ---------- Agendamentos ----------
async def _hydrate_agendamento(doc: dict) -> AgendamentoOut:
    doc.pop("_id", None)
    return AgendamentoOut(**doc)


@api.post("/agendamentos", response_model=AgendamentoOut, status_code=201)
async def criar_agendamento(data: AgendamentoIn, u: dict = Depends(current_user)):
    # Validate barbeiro
    b = await barbeiros_col.find_one({"id": data.barbeiro_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Barbeiro não encontrado")
    # Validate servico
    s = await servicos_col.find_one({"id": data.servico_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Serviço não encontrado")
    # Validate date format
    try:
        datetime.strptime(data.data, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Formato de data inválido (use YYYY-MM-DD)")
    if data.horario not in DEFAULT_SLOTS:
        raise HTTPException(400, "Horário inválido")
    if (b.get("status") or "Ativo").lower() != "ativo":
        raise HTTPException(400, "Barbeiro indisponível")
    if is_past(data.data, data.horario):
        raise HTTPException(400, "Não é possível agendar em data/horário passado")
    dur = int(s.get("duracao_minutos") or SLOT_MIN)
    span = slot_span(data.horario, dur)
    if len(span) < max(1, -(-dur // SLOT_MIN)):
        raise HTTPException(400, "Serviço ultrapassa o horário de funcionamento")
    # Conflict check (considers service duration)
    if set(span) & await occupied_slots(data.barbeiro_id, data.data):
        raise HTTPException(409, "Horário já ocupado para este barbeiro")

    doc = {
        "id": str(uuid.uuid4()),
        "cliente_id": u["id"],
        "cliente_nome": u["nome"],
        "barbeiro_id": b["id"],
        "barbeiro_nome": b["nome"],
        "servico_id": s["id"],
        "servico_nome": s["nome"],
        "servico_preco": s["preco"],
        "duracao_minutos": dur,
        "data": data.data,
        "horario": data.horario,
        "status": AgendamentoStatus.pendente.value,
        "ativo": True,
        "observacao": data.observacao,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await agendamentos_col.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Horário já ocupado para este barbeiro")
    return await _hydrate_agendamento(dict(doc))


@api.get("/agendamentos/me", response_model=List[AgendamentoOut])
async def meus_agendamentos(u: dict = Depends(current_user)):
    rows = (
        await agendamentos_col.find({"cliente_id": u["id"]}, {"_id": 0})
        .sort([("data", 1), ("horario", 1)])
        .to_list(500)
    )
    return [AgendamentoOut(**r) for r in rows]


@api.get("/agendamentos", response_model=List[AgendamentoOut])
async def listar_agendamentos(
    u: dict = Depends(current_user),
    data_ag: Optional[str] = Query(None, alias="data"),
    barbeiro_id: Optional[str] = Query(None),
):
    """Admin: all; Barbeiro: own; Cliente: own."""
    q: dict = {}
    if u["role"] == Role.barbeiro.value:
        if not u.get("barbeiro_id"):
            return []
        q["barbeiro_id"] = u["barbeiro_id"]
    elif u["role"] == Role.cliente.value:
        q["cliente_id"] = u["id"]
    # admin: no additional filter
    if data_ag:
        q["data"] = data_ag
    if barbeiro_id and u["role"] == Role.admin.value:
        q["barbeiro_id"] = barbeiro_id
    rows = (
        await agendamentos_col.find(q, {"_id": 0})
        .sort([("data", 1), ("horario", 1)])
        .to_list(500)
    )
    return [AgendamentoOut(**r) for r in rows]


@api.patch("/agendamentos/{agendamento_id}/status", response_model=AgendamentoOut)
async def update_status(
    agendamento_id: str, body: StatusUpdate, u: dict = Depends(current_user)
):
    ag = await agendamentos_col.find_one({"id": agendamento_id}, {"_id": 0})
    if not ag:
        raise HTTPException(404, "Agendamento não encontrado")
    # Permissions:
    # cliente: pode cancelar o próprio
    # barbeiro: pode mudar status dos seus
    # admin: tudo
    role = u["role"]
    if role == Role.cliente.value:
        if ag["cliente_id"] != u["id"] or body.status != AgendamentoStatus.cancelado:
            raise HTTPException(403, "Permissão negada")
    elif role == Role.barbeiro.value:
        if ag["barbeiro_id"] != u.get("barbeiro_id"):
            raise HTTPException(403, "Permissão negada")
    # Transition rules (final states cannot be changed)
    if body.status.value not in ALLOWED_TRANSITIONS.get(ag["status"], set()):
        raise HTTPException(400, f"Não é possível alterar de {ag['status']} para {body.status.value}")
    updated = await agendamentos_col.find_one_and_update(
        {"id": agendamento_id},
        {"$set": {
            "status": body.status.value,
            "ativo": body.status != AgendamentoStatus.cancelado,
        }},
        return_document=True,
        projection={"_id": 0},
    )
    return AgendamentoOut(**updated)


# ---------- Admin: Users ----------
@api.get("/admin/users", response_model=List[UserOut])
async def admin_list_users(_: dict = Depends(require_roles("admin"))):
    rows = await users_col.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return [public_user(r) for r in rows]


class RoleUpdate(BaseModel):
    role: Role
    barbeiro_id: Optional[str] = None


@api.patch("/admin/users/{user_id}/role", response_model=UserOut)
async def admin_set_role(
    user_id: str, body: RoleUpdate, me_: dict = Depends(require_roles("admin"))
):
    if user_id == me_["id"] and body.role != Role.admin:
        raise HTTPException(400, "Você não pode remover seu próprio acesso de admin")
    update: dict = {"role": body.role.value, "barbeiro_id": None}
    if body.role == Role.barbeiro:
        if not body.barbeiro_id or not await barbeiros_col.find_one({"id": body.barbeiro_id}):
            raise HTTPException(400, "Selecione um barbeiro válido")
        update["barbeiro_id"] = body.barbeiro_id
    r = await users_col.find_one_and_update(
        {"id": user_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0, "password_hash": 0},
    )
    if not r:
        raise HTTPException(404, "Usuário não encontrado")
    return public_user(r)


# ---------- Stats (admin) ----------
@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_roles("admin"))):
    today = datetime.now(LOCAL_TZ).date().isoformat()
    total_users = await users_col.count_documents({})
    total_clientes = await users_col.count_documents({"role": "cliente"})
    total_barbeiros = await barbeiros_col.count_documents({})
    total_servicos = await servicos_col.count_documents({})
    total_produtos = await produtos_col.count_documents({})
    total_ags = await agendamentos_col.count_documents({})
    ags_hoje = await agendamentos_col.count_documents({"data": today})
    pipeline = [
        {"$match": {"status": "Realizado"}},
        {"$group": {"_id": None, "total": {"$sum": "$servico_preco"}}},
    ]
    receita = 0.0
    async for d in agendamentos_col.aggregate(pipeline):
        receita = float(d.get("total", 0) or 0)
    return {
        "total_users": total_users,
        "total_clientes": total_clientes,
        "total_barbeiros": total_barbeiros,
        "total_servicos": total_servicos,
        "total_produtos": total_produtos,
        "total_agendamentos": total_ags,
        "agendamentos_hoje": ags_hoje,
        "receita_total": receita,
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
