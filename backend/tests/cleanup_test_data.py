# Cleanup helper: cancels bookings tied to TEST_ barbeiros/servicos and deletes TEST_ entities
import os
import requests

API = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/") + "/api"
tok = requests.post(f"{API}/auth/login", data={"username": "admin@barbearia.com", "password": "Admin@12345"}).json()["access_token"]
h = {"Authorization": f"Bearer {tok}"}
bs = [b for b in requests.get(f"{API}/barbeiros").json() if b["nome"].startswith("TEST")]
ss = [s for s in requests.get(f"{API}/servicos").json() if s["nome"].startswith("TEST")]
ids_b, ids_s = {b["id"] for b in bs}, {s["id"] for s in ss}
for a in requests.get(f"{API}/agendamentos", headers=h).json():
    if (a["barbeiro_id"] in ids_b or a["servico_id"] in ids_s) and a["status"] in ("Pendente", "Confirmado"):
        requests.patch(f"{API}/agendamentos/{a['id']}/status", json={"status": "Cancelado"}, headers=h)
for s in ss:
    print("del servico", s["nome"], requests.delete(f"{API}/servicos/{s['id']}", headers=h).status_code)
for b in bs:
    print("del barbeiro", b["nome"], requests.delete(f"{API}/barbeiros/{b['id']}", headers=h).status_code)
