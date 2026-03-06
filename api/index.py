from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI()

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


@app.get("/")
def welcome():
    return FileResponse(os.path.join(BASE_DIR, "screens", "welcome.html"))


@app.get("/dashboard")
def dashboard():
    return FileResponse(os.path.join(BASE_DIR, "screens", "dashboard.html"))


@app.get("/finance")
def finance():
    return FileResponse(os.path.join(BASE_DIR, "screens", "finance.html"))


# ── FINANCE ──────────────────────────────────────────────

class Transaction(BaseModel):
    title: str
    amount: float
    category: str
    type: str        # "entrata" | "uscita"
    date: str
    note: Optional[str] = None


@app.get("/api/finance/transactions")
def get_transactions():
    response = supabase.table("transactions").select("*").order("date", desc=True).execute()
    return response.data


@app.post("/api/finance/transactions", status_code=201)
def create_transaction(tx: Transaction):
    response = supabase.table("transactions").insert(tx.model_dump()).execute()
    return response.data[0]


@app.delete("/api/finance/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int):
    supabase.table("transactions").delete().eq("id", tx_id).execute()


class Todo(BaseModel):
    title: str
    completed: bool = False


# GET tutti i todo
@app.get("/api/todos")
def get_todos():
    response = supabase.table("todos").select("*").execute()
    return response.data


# GET singolo todo
@app.get("/api/todos/{todo_id}")
def get_todo(todo_id: int):
    response = supabase.table("todos").select("*").eq("id", todo_id).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Todo non trovato")
    return response.data


# POST crea todo
@app.post("/api/todos", status_code=201)
def create_todo(todo: Todo):
    response = supabase.table("todos").insert(todo.model_dump()).execute()
    return response.data[0]


# PATCH aggiorna todo
@app.patch("/api/todos/{todo_id}")
def update_todo(todo_id: int, todo: Todo):
    response = (
        supabase.table("todos")
        .update(todo.model_dump(exclude_unset=True))
        .eq("id", todo_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Todo non trovato")
    return response.data[0]


# DELETE elimina todo
@app.delete("/api/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    supabase.table("todos").delete().eq("id", todo_id).execute()
