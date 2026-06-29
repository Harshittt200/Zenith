import os
import json
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from agents import planner_graph, scheduler_graph, chat_graph, prioritizer_node, insight_node
from google_calendar import TOKEN_PATH

app = FastAPI(title="Zenith LangGraph Server")

# Enable CORS for React frontend (Vite dev server ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'zenith_db.json')

# Pydantic Schemas
class Subtask(BaseModel):
    id: str
    title: str
    completed: bool

class Task(BaseModel):
    id: str
    title: str
    deadline: str
    duration: int
    difficulty: str
    category: str
    completed: bool
    priorityScore: Optional[int] = 0
    subtasks: List[Subtask] = []

class TaskCreate(BaseModel):
    title: str
    deadline: str
    duration: int
    difficulty: str
    category: str
    autoDecompose: bool

class Habit(BaseModel):
    id: str
    name: str
    frequency: str
    time: str
    streak: int
    history: Dict[str, bool] = {}

class HabitCreate(BaseModel):
    name: str
    frequency: str
    time: str

class Settings(BaseModel):
    username: str
    dailyFocusTarget: int
    voiceURI: str
    pitch: float
    rate: float

class ChatMessage(BaseModel):
    sender: str
    text: str

class ChatPayload(BaseModel):
    message: str
    history: List[ChatMessage]

# Helper to read/write JSON database
def load_db() -> dict:
    if not os.path.exists(DB_PATH):
        # Default database
        today = datetime.datetime.now()
        tomorrow = today + datetime.timedelta(days=1)
        tomorrow = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
        day_after = today + datetime.timedelta(days=2)
        day_after = day_after.replace(hour=17, minute=30, second=0, microsecond=0)
        
        default_db = {
            "tasks": [
                {
                    "id": "task-py-1",
                    "title": "Deconstruct Deep Learning Backpropagation",
                    "deadline": tomorrow.isoformat() + "Z",
                    "duration": 120,
                    "difficulty": "high",
                    "category": "study",
                    "completed": False,
                    "priorityScore": 75,
                    "subtasks": [
                        { "id": "sub-py-1-1", "title": "Read Chapter 3 textbook notes", "completed": True },
                        { "id": "sub-py-1-2", "title": "Derive partial derivatives on paper", "completed": False },
                        { "id": "sub-py-1-3", "title": "Code simple numpy layer test", "completed": False }
                    ]
                },
                {
                    "id": "task-py-2",
                    "title": "Draft Zenith Product Pitch Deck",
                    "deadline": day_after.isoformat() + "Z",
                    "duration": 90,
                    "difficulty": "medium",
                    "category": "work",
                    "completed": False,
                    "priorityScore": 55,
                    "subtasks": [
                        { "id": "sub-py-2-1", "title": "Establish core value propositions", "completed": True },
                        { "id": "sub-py-2-2", "title": "Create slide layouts & wireframe aesthetics", "completed": True }
                    ]
                }
            ],
            "habits": [
                {
                    "id": "habit-py-1",
                    "name": "Deep Work Session (90 min)",
                    "frequency": "daily",
                    "time": "09:00",
                    "streak": 4,
                    "history": {}
                }
            ],
            "settings": {
                "username": "Harshit",
                "dailyFocusTarget": 240,
                "voiceURI": "default",
                "pitch": 1.0,
                "rate": 1.0
            }
        }
        save_db(default_db)
        return default_db
    
    with open(DB_PATH, "r") as f:
        return json.load(f)

def save_db(data: dict):
    with open(DB_PATH, "w") as f:
        json.dump(data, f, indent=4)

# REST API Endpoints

@app.get("/api/tasks", response_model=List[Task])
def get_tasks():
    db = load_db()
    
    # Execute prioritizer node directly to score tasks in real time
    state = {
        "tasks": db["tasks"],
        "habits": db["habits"],
        "logs": []
    }
    result = prioritizer_node(state)
    db["tasks"] = result["tasks"]
    save_db(db)
    return db["tasks"]

@app.post("/api/tasks", response_model=Task)
def create_task(payload: TaskCreate):
    db = load_db()
    
    new_task = {
        "id": f"task-{int(datetime.datetime.now().timestamp())}",
        "title": payload.title,
        "deadline": payload.deadline,
        "duration": payload.duration,
        "difficulty": payload.difficulty,
        "category": payload.category,
        "completed": False,
        "subtasks": []
    }
    
    # Compile and invoke LangGraph Planner Graph (planner -> prioritizer)
    state = {
        "tasks": db["tasks"],
        "habits": db["habits"],
        "new_task": new_task,
        "auto_decompose": payload.autoDecompose,
        "logs": []
    }
    
    result = planner_graph.invoke(state)
    db["tasks"] = result["tasks"]
    save_db(db)
    
    # Return the newly appended task
    return db["tasks"][-1]

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    db = load_db()
    db["tasks"] = [t for t in db["tasks"] if t["id"] != task_id]
    save_db(db)
    return {"status": "success"}

@app.patch("/api/tasks/{task_id}/toggle", response_model=Task)
def toggle_task(task_id: str):
    db = load_db()
    target_task = None
    for t in db["tasks"]:
        if t["id"] == task_id:
            t["completed"] = not t["completed"]
            if t["completed"] and t.get("subtasks"):
                for sub in t["subtasks"]:
                    sub["completed"] = True
            target_task = t
            break
            
    if not target_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    save_db(db)
    return target_task

@app.patch("/api/tasks/{task_id}/subtask/{subtask_id}/toggle", response_model=Task)
def toggle_subtask(task_id: str, subtask_id: str):
    db = load_db()
    target_task = None
    for t in db["tasks"]:
        if t["id"] == task_id:
            for sub in t["subtasks"]:
                if sub["id"] == subtask_id:
                    sub["completed"] = not sub["completed"]
            
            # If all subtasks are complete, complete main task
            if t.get("subtasks"):
                all_done = all(sub["completed"] for sub in t["subtasks"])
                t["completed"] = all_done
            
            target_task = t
            break
            
    if not target_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    save_db(db)
    return target_task

# Habits
@app.get("/api/habits", response_model=List[Habit])
def get_habits():
    db = load_db()
    return db["habits"]

@app.post("/api/habits", response_model=Habit)
def create_habit(payload: HabitCreate):
    db = load_db()
    new_habit = {
        "id": f"habit-{int(datetime.datetime.now().timestamp())}",
        "name": payload.name,
        "frequency": payload.frequency,
        "time": payload.time,
        "streak": 0,
        "history": {}
    }
    db["habits"].append(new_habit)
    save_db(db)
    return new_habit

@app.post("/api/habits/{habit_id}/toggle/{date_str}", response_model=Habit)
def toggle_habit(habit_id: str, date_str: str):
    db = load_db()
    target_habit = None
    for h in db["habits"]:
        if h["id"] == habit_id:
            if "history" not in h or h["history"] is None:
                h["history"] = {}
                
            if h["history"].get(date_str, False):
                h["history"][date_str] = False
                h["streak"] = max(0, h["streak"] - 1)
            else:
                h["history"][date_str] = True
                h["streak"] = h["streak"] + 1
            target_habit = h
            break
            
    if not target_habit:
        raise HTTPException(status_code=404, detail="Habit not found")
        
    save_db(db)
    return target_habit

@app.delete("/api/habits/{habit_id}")
def delete_habit(habit_id: str):
    db = load_db()
    db["habits"] = [h for h in db["habits"] if h["id"] != habit_id]
    save_db(db)
    return {"status": "success"}

# Insights
@app.get("/api/insights")
def get_insights():
    db = load_db()
    state = {
        "tasks": db["tasks"],
        "habits": db["habits"],
        "logs": []
    }
    result = insight_node(state)
    return result["insights"]

# Calendar Optimization
@app.get("/api/calendar")
def get_calendar():
    db = load_db()
    
    # Invoke LangGraph Scheduler Graph in read-only mode (skips GCal sync)
    state = {
        "tasks": db["tasks"],
        "habits": db["habits"],
        "calendar_blocks": [],
        "insights": [],
        "logs": [],
        "skip_gcal_sync": True
    }
    result = scheduler_graph.invoke(state)
    return {
        "calendar_blocks": result["calendar_blocks"]
    }

@app.post("/api/optimize")
def optimize_schedule():
    db = load_db()
    
    # Invoke LangGraph Scheduler Graph (full optimize with GCal sync)
    state = {
        "tasks": db["tasks"],
        "habits": db["habits"],
        "calendar_blocks": [],
        "insights": [],
        "logs": [],
        "skip_gcal_sync": False
    }
    result = scheduler_graph.invoke(state)
    
    # Return both blocks and insights to prevent duplicate API queries
    return {
        "calendar_blocks": result["calendar_blocks"],
        "insights": result["insights"]
    }

# Chat Companion
@app.post("/api/chat")
def chat_companion(payload: ChatPayload):
    db = load_db()
    history_list = [{"sender": h.sender, "text": h.text} for h in payload.history]
    
    state = {
        "tasks": db["tasks"],
        "habits": db["habits"],
        "chat_message": payload.message,
        "chat_history": history_list,
        "chat_reply": "",
        "logs": []
    }
    result = chat_graph.invoke(state)
    
    # Save any new task reminder objects created by the Chat Agent
    db["tasks"] = result.get("tasks", db["tasks"])
    save_db(db)
    
    return {"reply": result["chat_reply"]}

# Settings
@app.get("/api/settings", response_model=Settings)
def get_settings():
    db = load_db()
    return db["settings"]

@app.post("/api/settings", response_model=Settings)
def save_settings(payload: Settings):
    db = load_db()
    db["settings"] = payload.model_dump()
    save_db(db)
    return db["settings"]

# Logout / Token Deletion
@app.post("/api/logout")
def logout():
    if os.path.exists(TOKEN_PATH):
        try:
            os.remove(TOKEN_PATH)
            print("[Google Calendar] token.json deleted successfully on logout.")
        except Exception as e:
            print(f"[Google Calendar] Error deleting token.json: {e}")
    return {"status": "success"}

# Serve vanilla HTML/CSS/JS frontend files
frontend_dist_dir = os.path.join(os.path.dirname(BASE_DIR), 'frontend', 'dist')
if os.path.exists(frontend_dist_dir):
    app.mount("/", StaticFiles(directory=frontend_dist_dir, html=True), name="frontend")
else:
    # Fallback to root vanilla frontend files
    ZENITH_DIR = os.path.dirname(BASE_DIR)
    css_dir = os.path.join(ZENITH_DIR, 'css')
    js_dir = os.path.join(ZENITH_DIR, 'js')

    if os.path.exists(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")

    @app.get("/")
    def read_index():
        index_path = os.path.join(ZENITH_DIR, 'index.html')
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="index.html not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
