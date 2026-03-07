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


@app.get("/auth")
def auth():
    return FileResponse(os.path.join(BASE_DIR, "screens", "auth.html"))


@app.get("/dashboard")
def dashboard():
    return FileResponse(os.path.join(BASE_DIR, "screens", "index.html"))


@app.get("/finance")
def finance():
    return FileResponse(os.path.join(BASE_DIR, "screens", "index.html"))


@app.get("/psychology")
def psychology():
    return FileResponse(os.path.join(BASE_DIR, "screens", "index.html"))


@app.get("/health")
def health():
    return FileResponse(os.path.join(BASE_DIR, "screens", "index.html"))


@app.get("/consciousness")
def consciousness():
    return FileResponse(os.path.join(BASE_DIR, "screens", "index.html"))


@app.get("/settings")
def settings():
    return FileResponse(os.path.join(BASE_DIR, "screens", "index.html"))


@app.get("/badges")
def badges():
    return FileResponse(os.path.join(BASE_DIR, "screens", "index.html"))


# ── USER PREFERENCES ─────────────────────────────────────

class UserPreferences(BaseModel):
    user_id: str
    name:     Optional[str]  = None
    theme:    str             = "terracotta"
    lang:     str             = "it"
    greeting: bool            = True
    grid:     bool            = True
    anim:     bool            = True


@app.get("/api/user/preferences/{user_id}")
def get_preferences(user_id: str):
    response = (
        supabase.table("user_preferences")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else {}


@app.put("/api/user/preferences", status_code=200)
def upsert_preferences(prefs: UserPreferences):
    response = (
        supabase.table("user_preferences")
        .upsert(prefs.model_dump(), on_conflict="user_id")
        .execute()
    )
    return response.data[0] if response.data else {}


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


# IMPORTANT: /all must be defined before /{tx_id} so FastAPI doesn't treat "all" as an int
@app.delete("/api/finance/transactions/all", status_code=204)
def delete_all_transactions():
    supabase.table("transactions").delete().gte("id", 0).execute()


@app.delete("/api/finance/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int):
    supabase.table("transactions").delete().eq("id", tx_id).execute()


# ── PSYCHOLOGY ───────────────────────────────────────────

class PsychologyEntry(BaseModel):
    mood: int               # 1-5
    title: str
    date: str
    category: str
    note: Optional[str] = None


@app.get("/api/psychology/entries")
def get_psychology_entries():
    response = supabase.table("psychology_entries").select("*").order("date", desc=True).execute()
    return response.data


@app.post("/api/psychology/entries", status_code=201)
def create_psychology_entry(entry: PsychologyEntry):
    response = supabase.table("psychology_entries").insert(entry.model_dump()).execute()
    return response.data[0]


@app.delete("/api/psychology/entries/all", status_code=204)
def delete_all_psychology_entries():
    supabase.table("psychology_entries").delete().gte("id", 0).execute()


@app.delete("/api/psychology/entries/{entry_id}", status_code=204)
def delete_psychology_entry(entry_id: int):
    supabase.table("psychology_entries").delete().eq("id", entry_id).execute()


# ── HEALTH ───────────────────────────────────────────────

class HealthActivity(BaseModel):
    kind: str               # "workout" | "sleep"
    date: str
    note: Optional[str] = None
    # workout fields
    type: Optional[str] = None
    duration: Optional[int] = None
    intensity: Optional[int] = None
    # sleep fields
    hours: Optional[float] = None
    quality: Optional[int] = None


@app.get("/api/health/activities")
def get_health_activities():
    response = supabase.table("health_activities").select("*").order("date", desc=True).execute()
    return response.data


@app.post("/api/health/activities", status_code=201)
def create_health_activity(activity: HealthActivity):
    response = supabase.table("health_activities").insert(activity.model_dump()).execute()
    return response.data[0]


@app.delete("/api/health/activities/all", status_code=204)
def delete_all_health_activities():
    supabase.table("health_activities").delete().gte("id", 0).execute()


@app.delete("/api/health/activities/{activity_id}", status_code=204)
def delete_health_activity(activity_id: int):
    supabase.table("health_activities").delete().eq("id", activity_id).execute()


# ── CONSCIOUSNESS ─────────────────────────────────────────

class ConsciousnessNote(BaseModel):
    text: str
    source: str             # "text" | "voice"
    date: str


@app.get("/api/consciousness/notes")
def get_consciousness_notes():
    response = supabase.table("consciousness_notes").select("*").order("date", desc=True).execute()
    return response.data


@app.post("/api/consciousness/notes", status_code=201)
def create_consciousness_note(note: ConsciousnessNote):
    response = supabase.table("consciousness_notes").insert(note.model_dump()).execute()
    return response.data[0]


@app.delete("/api/consciousness/notes/all", status_code=204)
def delete_all_consciousness_notes():
    supabase.table("consciousness_notes").delete().gte("id", 0).execute()


@app.delete("/api/consciousness/notes/{note_id}", status_code=204)
def delete_consciousness_note(note_id: int):
    supabase.table("consciousness_notes").delete().eq("id", note_id).execute()


# ── TODOS ─────────────────────────────────────────────────

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
