import os
import json
import datetime
from typing import TypedDict, List, Dict, Any, Optional

from langgraph.graph import StateGraph, START, END
from google_calendar import sync_events_to_google_calendar, get_external_calendar_events

# Load env variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

API_KEY = os.environ.get("GEMINI_API_KEY")
MISTRAL_KEY = os.environ.get("MISTRAL_API_KEY")
LLM = None

if MISTRAL_KEY:
    try:
        from langchain_mistralai import ChatMistralAI
        LLM = ChatMistralAI(model="mistral-large-latest", mistral_api_key=MISTRAL_KEY, temperature=0.7)
        print("[Zenith AI] LangChain ChatMistralAI successfully initialized (Mistral AI).")
    except Exception as e:
        print(f"[Zenith AI] Error loading LangChain Mistral wrapper: {e}. Checking Gemini...")

if not LLM and API_KEY:
    try:
        from langchain_google_genai import ChatGoogleGenAI
        LLM = ChatGoogleGenAI(model="gemini-2.5-flash", google_api_key=API_KEY, temperature=0.7)
        print("[Zenith AI] LangChain ChatGoogleGenAI successfully initialized (Google Gemini).")
    except Exception as e:
        print(f"[Zenith AI] Error loading LangChain Google wrapper: {e}. Running local fallbacks.")

if not LLM:
    print("[Zenith AI] No active API keys (GEMINI_API_KEY or MISTRAL_API_KEY) found. LangChain LLM nodes will run in fallback simulator mode.")

# --- LangGraph State Definition ---
class AgentState(TypedDict):
    tasks: List[dict]
    habits: List[dict]
    
    # Task Inputs
    new_task: Optional[dict]
    auto_decompose: bool
    
    # Calendar Inputs / Outputs
    calendar_blocks: List[dict]
    
    # Recommendation Outputs
    insights: List[dict]
    
    # Conversational Chat Inputs / Outputs
    chat_message: Optional[str]
    chat_history: List[dict]
    chat_reply: Optional[str]
    
    # Agent logs
    logs: List[str]
    skip_gcal_sync: Optional[bool]


# Helper log printer
def log_agent_thought(agent_name: str, action: str, details: str, state: AgentState):
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    msg = f"[{timestamp}] {agent_name} -> {action}: {details}"
    print(msg)
    state['logs'].append(msg)


# --- LangGraph Node Functions ---

def planner_node(state: AgentState) -> Dict[str, Any]:
    task = state.get("new_task")
    if not task:
        return {}

    log_agent_thought("PlannerAgent", "Analyze", f"Planning subtasks checklist for '{task['title']}'", state)
    
    subtasks = []
    
    # 1. Try LangChain Gemini LLM
    if LLM:
        try:
            prompt = (
                f"Decompose the task: '{task['title']}' into 3 or 4 short, actionable subtask steps. "
                f"Output strictly as a raw JSON array of strings (no explanation, no markdown tags). "
                f"Example: [\"Prepare layout outline\", \"Create slides\", \"Practice presentation\"]"
            )
            response = LLM.invoke(prompt)
            text = response.content.strip()
            
            # Clean possible markdown blocks
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("\n", 1)[0]
                if text.startswith("json"):
                    text = text[4:].strip()
            
            subtask_titles = json.loads(text.strip())
            subtasks = [
                {"id": f"sub-{int(datetime.datetime.now().timestamp())}-{i}", "title": t, "completed": False} 
                for i, t in enumerate(subtask_titles)
            ]
            log_agent_thought("PlannerAgent", "Success", f"Gemini decomposed task into {len(subtasks)} steps.", state)
        except Exception as e:
            log_agent_thought("PlannerAgent", "Warning", f"LangChain call failed ({e}). Reverting to pattern simulator.", state)
            LLM_failed = True
        else:
            LLM_failed = False
    else:
        LLM_failed = True

    # 2. Local Fallback Simulator
    if LLM_failed:
        lower_title = task['title'].lower()
        subtask_titles = []
        if any(w in lower_title for w in ['study', 'exam', 'test', 'learn']):
            subtask_titles = [
                'Review lecture notes & textbook chapters',
                'Extract key vocabulary and active recall concepts',
                'Attempt mock questions or flashcard set',
                'Synthesize weak areas in a 1-page summary'
            ]
        elif any(w in lower_title for w in ['presentation', 'slides', 'speech', 'talk']):
            subtask_titles = [
                'Outline script storyline & core takeaways',
                'Draft slide contents, layout grids & visual assets',
                'Perform initial vocal run-through and time-check',
                'Polishing slide transitions & final dress rehearsal'
            ]
        elif any(w in lower_title for w in ['code', 'program', 'develop', 'app', 'bug', 'build']):
            subtask_titles = [
                'Diagram software architecture / UI wireframe flow',
                'Initialize codebase structure and config parameters',
                'Code core functionality & logic controllers',
                'Run unit testing checks and refine styling UI'
            ]
        elif any(w in lower_title for w in ['report', 'draft', 'write', 'paper', 'essay']):
            subtask_titles = [
                'Gather relevant references, facts & citations',
                'Formulate thesis intro & structural body outline',
                'Draft draft content (avoid editing while writing)',
                'Proofread flow, syntax style and verify requirements'
            ]
        else:
            subtask_titles = [
                'Define key objective & criteria for completion',
                'Gather all tools, links & dependencies',
                'Execute primary task segments (Deep Work focus block)',
                'Verify quality check and mark as complete'
            ]
        
        subtasks = [
            {"id": f"sub-{int(datetime.datetime.now().timestamp())}-{i}", "title": t, "completed": False} 
            for i, t in enumerate(subtask_titles)
        ]
        log_agent_thought("PlannerAgent", "Success", f"Fallback simulator decomposed task into {len(subtasks)} steps.", state)

    # Update tasks list
    task['subtasks'] = subtasks
    updated_tasks = list(state.get("tasks", []))
    updated_tasks.append(task)
    
    return {
        "tasks": updated_tasks,
        "logs": state["logs"]
    }


def prioritizer_node(state: AgentState) -> Dict[str, Any]:
    log_agent_thought("PrioritizerAgent", "Score", "Calculating urgency-importance rating for active agenda.", state)
    
    updated_tasks = list(state.get("tasks", []))
    now = datetime.datetime.now()

    for task in updated_tasks:
        if task.get('completed', False):
            task['priorityScore'] = 0
            continue
            
        # 1. Deadline score
        try:
            deadline = datetime.datetime.fromisoformat(task['deadline'].replace('Z', '+00:00'))
            deadline = deadline.replace(tzinfo=None)
        except ValueError:
            deadline = now + datetime.timedelta(days=1)

        time_diff = deadline - now
        time_diff_hours = time_diff.total_seconds() / 3600
        
        if time_diff_hours <= 0:
            deadline_score = 100
        elif time_diff_hours <= 2:
            deadline_score = 100
        elif time_diff_hours <= 12:
            deadline_score = 90
        elif time_diff_hours <= 24:
            deadline_score = 75
        elif time_diff_hours <= 48:
            deadline_score = 55
        elif time_diff_hours <= 168:
            deadline_score = 30
        else:
            deadline_score = 15

        # 2. Difficulty score
        diff_score = 50
        difficulty = task.get('difficulty', 'medium')
        if difficulty == 'high':
            diff_score = 100
        elif difficulty == 'medium':
            diff_score = 70
        elif difficulty == 'low':
            diff_score = 30

        # 3. Duration score
        duration = int(task.get('duration', 60))
        if duration >= 180:
            duration_score = 100
        elif duration >= 90:
            duration_score = 80
        elif duration >= 45:
            duration_score = 60
        else:
            duration_score = 30

        score = (deadline_score * 0.5) + (diff_score * 0.3) + (duration_score * 0.2)
        task['priorityScore'] = min(max(round(score), 0), 100)

    log_agent_thought("PrioritizerAgent", "Success", "Priority scores updated.", state)
    
    return {
        "tasks": updated_tasks,
        "logs": state["logs"]
    }


def scheduler_node(state: AgentState) -> Dict[str, Any]:
    log_agent_thought("CalendarAgent", "Optimize", "Regrouping calendar blocks to minimize context fatigue.", state)
    
    # 1. Fetch external events from Google Calendar
    external_blocks = []
    try:
        external_blocks = get_external_calendar_events()
        if external_blocks:
            log_agent_thought("CalendarAgent", "GCal Sync", f"Retrieved {len(external_blocks)} external events from Google Calendar.", state)
    except Exception as e:
         log_agent_thought("CalendarAgent", "Warning", f"Could not retrieve Google Calendar events: {e}", state)

    active_tasks = [t for t in state.get("tasks", []) if not t.get('completed', False)]
    if not active_tasks and not external_blocks:
        return {"calendar_blocks": [], "logs": state["logs"]}

    # Sort tasks: High energy first, then medium, then low
    energy_order = {'high': 3, 'medium': 2, 'low': 1}
    active_tasks.sort(key=lambda t: energy_order.get(t.get('difficulty', 'medium'), 2), reverse=True)

    calendar_blocks = []
    current_hour = 9.0  # 9:00 AM

    def format_time(hour_float):
        h = int(hour_float)
        m = int((hour_float - h) * 60)
        period = 'PM' if h >= 12 else 'AM'
        display_h = h - 12 if h > 12 else h
        display_h = 12 if display_h == 0 else display_h
        return f"{display_h:02d}:{m:02d} {period}"

    for task in active_tasks:
        if current_hour >= 17.0:
            break

        start_h = current_hour
        duration_hours = int(task.get('duration', 60)) / 60.0
        
        try:
            deadline = datetime.datetime.fromisoformat(task['deadline'].replace('Z', '+00:00'))
            day_of_week = deadline.isoweekday()
        except ValueError:
            day_of_week = 1

        # Check for overlaps with external Google Calendar events on this day, sliding the time forward
        overlapping = True
        while overlapping:
            overlapping = False
            for ext in external_blocks:
                if ext['dayOfWeek'] == day_of_week:
                    ext_start = ext['startHour']
                    ext_end = ext_start + ext['durationHours']
                    
                    # If start_h is inside the external event, or task spans across the external event
                    if (start_h < ext_end) and (start_h + duration_hours > ext_start):
                        # Advance start_h pointer past the external event
                        start_h = ext_end
                        overlapping = True
                        break

        end_h = start_h + duration_hours
        if start_h >= 17.0:
            # Task pushed past 5 PM, don't schedule it today
            break

        block = {
            "taskId": task['id'],
            "title": task['title'],
            "category": task.get('category', 'work'),
            "startTimeStr": format_time(start_h),
            "endTimeStr": format_time(end_h),
            "startHour": start_h,
            "durationHours": duration_hours,
            "dayOfWeek": day_of_week
        }
        calendar_blocks.append(block)
        current_hour = end_h

        # Injects Guided Recharge Break if task was high energy
        if task.get('difficulty', 'medium') == 'high' and current_hour < 17.0:
            rest_start = current_hour
            rest_duration = 0.25
            
            # Slide rest break if it overlaps
            rest_overlapping = True
            while rest_overlapping:
                rest_overlapping = False
                for ext in external_blocks:
                    if ext['dayOfWeek'] == day_of_week:
                        ext_start = ext['startHour']
                        ext_end = ext_start + ext['durationHours']
                        if (rest_start < ext_end) and (rest_start + rest_duration > ext_start):
                            rest_start = ext_end
                            rest_overlapping = True
                            break
                            
            rest_end = rest_start + rest_duration
            if rest_start < 17.0:
                calendar_blocks.append({
                    "taskId": f"ai-break-{int(datetime.datetime.now().timestamp())}",
                    "title": "🧘 AI Guided Recharge Break",
                    "category": "life",
                    "startTimeStr": format_time(rest_start),
                    "endTimeStr": format_time(rest_end),
                    "startHour": rest_start,
                    "durationHours": rest_duration,
                    "dayOfWeek": day_of_week
                })
                current_hour = rest_end

    log_agent_thought("CalendarAgent", "Success", f"Optimized {len(calendar_blocks)} scheduled blocks.", state)

    # Sync with Google Calendar API if not skipped
    skip_sync = state.get("skip_gcal_sync", False)
    if not skip_sync:
        log_agent_thought("CalendarAgent", "Sync", "Running sync to user's primary Google Calendar account.", state)
        sync_success = sync_events_to_google_calendar(calendar_blocks)
        if sync_success:
            log_agent_thought("CalendarAgent", "Sync", "Google Calendar synchronization completed.", state)
        else:
            log_agent_thought("CalendarAgent", "Sync", "GCal sync skipped (credentials.json missing or unauthorized).", state)
    else:
        log_agent_thought("CalendarAgent", "Sync", "Google Calendar sync bypassed (read-only mode).", state)

    # Merge external blocks so the React UI shows them on the grid!
    calendar_blocks.extend(external_blocks)

    return {
        "calendar_blocks": calendar_blocks,
        "logs": state["logs"]
    }


def insight_node(state: AgentState) -> Dict[str, Any]:
    log_agent_thought("InsightAgent", "Analyze", "Assessing task lists and streaks to build recommendations.", state)
    
    active_tasks = [t for t in state.get("tasks", []) if not t.get('completed', False)]
    insights = []
    
    # 1. LangChain call
    if LLM:
        try:
            task_summary = [{"title": t['title'], "difficulty": t.get('difficulty', 'medium'), "completed": t.get('completed', False)} for t in state.get("tasks", [])]
            habit_summary = [{"name": h['name'], "streak": h.get('streak', 0)} for h in state.get("habits", [])]
            
            prompt = (
                f"Analyze the user's workload tasks: {json.dumps(task_summary)} "
                f"and active habits: {json.dumps(habit_summary)}. "
                f"Generate exactly 2 personal productivity recommendations or insights based on cognitive flow principles. "
                f"Return them strictly as a raw JSON list of objects containing 'title', 'type', and 'description'. "
                f"Example schema: [{{\"title\": \"Study Smart\", \"type\": \"purple\", \"description\": \"Focus block advised.\"}}]. "
                f"Available types: 'purple', 'green', 'cyan', 'pink', 'warning'."
            )
            response = LLM.invoke(prompt)
            text = response.content.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("\n", 1)[0]
                if text.startswith("json"):
                    text = text[4:].strip()
                    
            insights = json.loads(text.strip())
            log_agent_thought("InsightAgent", "Success", f"Gemini generated {len(insights)} custom insights.", state)
        except Exception as e:
            log_agent_thought("InsightAgent", "Warning", f"Insight call failed ({e}). Reverting to fallback.", state)
            LLM_failed = True
        else:
            LLM_failed = False
    else:
        LLM_failed = True

    # 2. Local Fallback
    if LLM_failed:
        if len(active_tasks) > 4:
            insights.append({
                "title": "High Workload Detected",
                "type": "warning",
                "description": f"You have {len(active_tasks)} active tasks. Focus on completing high-priority items first to prevent fatigue."
            })
        else:
            insights.append({
                "title": "Sufficient Workload",
                "type": "green",
                "description": "Your agenda is fully optimized. Zenith has scheduled appropriate cognitive deep focus intervals."
            })

        best_habit = None
        for h in state.get("habits", []):
            if not best_habit or h.get('streak', 0) > best_habit.get('streak', 0):
                best_habit = h

        if best_habit and best_habit.get('streak', 0) > 0:
            insights.append({
                "title": "Streaks Active",
                "type": "cyan",
                "description": f"Habit '{best_habit['name']}' has a streak of {best_habit['streak']} days. Repetitive cycles build neural automation."
            })
        else:
            insights.append({
                "title": "Add a Daily Ritual",
                "type": "pink",
                "description": "Establish a consistent habit block like 'Drink 2L Water' or 'Walk 10 min' to raise self-regulation score."
            })
        log_agent_thought("InsightAgent", "Success", f"Fallback simulator compiled {len(insights)} insights.", state)

    return {
        "insights": insights,
        "logs": state["logs"]
    }


def chat_node(state: AgentState) -> Dict[str, Any]:
    msg = state.get("chat_message")
    if not msg:
        return {}

    log_agent_thought("ChatAgent", "Chat", f"Generating companion response to: '{msg}'", state)
    reply = ""
    updated_tasks = list(state.get("tasks", []))
    reminder_created = False

    # 1. LangChain call
    if LLM:
        try:
            history_text = ""
            for chat in state.get("chat_history", [])[-5:]:
                history_text += f"{chat['sender']}: {chat['text']}\n"
            
            prompt = (
                f"You are Zenith, a friendly, modern, and highly intelligent AI productivity companion. "
                f"Keep your replies conversational, supportive, and under 3-4 sentences. "
                f"IMPORTANT: "
                f"1. If the user explicitly asks you to set a reminder or schedule a task (e.g., 'remind me to review code tomorrow at 4pm' or 'schedule study block'), "
                f"you MUST append a special system command tag to the end of your response in the format: "
                f"[REMINDER: title=\"TASK_TITLE\", deadline=\"ISO_DATETIME_STRING\"] "
                f"where deadline is in ISO 8601 format (e.g., YYYY-MM-DDThh:mm). If no date or time is specified, use tomorrow at 10 AM.\n"
                f"2. If the user asks you to clear, delete, wipe, or remove all tasks, or clear completed tasks (e.g., 'clear all tasks', 'delete completed tasks'), "
                f"you MUST append a system command tag to the end of your response in the format: "
                f"[CLEAR_TASKS: type=\"all\" | \"completed\"]\n"
                f"Current system date and time is: {datetime.datetime.now().isoformat()}.\n"
                f"Previous chat history:\n{history_text}"
                f"User message: {msg}\n"
                f"Zenith response:"
            )
            response = LLM.invoke(prompt)
            reply = response.content.strip()
            log_agent_thought("ChatAgent", "Success", "Gemini chat answer compiled.", state)
        except Exception as e:
            log_agent_thought("ChatAgent", "Warning", f"Chat API call failed ({e}). Reverting to default router.", state)
            LLM_failed = True
        else:
            LLM_failed = False
    else:
        LLM_failed = True

    # Parse LLM clear tasks tag if present
    clear_match = re.search(r'\[CLEAR_TASKS:\s*type="([^"]+)"\]', reply)
    if clear_match:
        clear_type = clear_match.group(1)
        reply = re.sub(r'\[CLEAR_TASKS:[^\]]+\]', '', reply).strip()
        if clear_type == "all":
            updated_tasks = []
            log_agent_thought("ChatAgent", "Action", "LLM request: Clear all tasks.", state)
        elif clear_type == "completed":
            updated_tasks = [t for t in updated_tasks if not t.get("completed")]
            log_agent_thought("ChatAgent", "Action", "LLM request: Clear completed tasks.", state)

    # Parse LLM reminder tag if present
    import re
    reminder_match = re.search(r'\[REMINDER:\s*title="([^"]+)",\s*deadline="([^"]+)"\]', reply)
    if reminder_match:
        task_title = reminder_match.group(1)
        task_deadline = reminder_match.group(2)
        
        # Strip tag from the response text
        reply = re.sub(r'\[REMINDER:[^\]]+\]', '', reply).strip()
        
        log_agent_thought("ChatAgent", "Action", f"LLM parsed reminder. Scheduling '{task_title}' for {task_deadline}", state)
        
        new_task = {
            "id": f"task-rem-{int(datetime.datetime.now().timestamp())}",
            "title": task_title,
            "deadline": task_deadline,
            "duration": 60,
            "difficulty": "medium",
            "category": "life",
            "completed": False,
            "subtasks": [
                {"id": f"sub-rem-{int(datetime.datetime.now().timestamp())}-1", "title": "Perform reminder action", "completed": False}
            ],
            "priorityScore": 70
        }
        updated_tasks.append(new_task)
        reminder_created = True

    # 2. Fallback Router / Local Regex Parser
    if LLM_failed or (not reminder_created and any(w in msg.lower() for w in ['remind', 'reminder', 'remainder', 'schedule', 'todo', 'task', 'call', 'clear', 'delete', 'remove', 'wipe'])):
        msg_lower = msg.lower()
        
        # Check if user wants to clear tasks locally
        if any(w in msg_lower for w in ['clear', 'delete', 'remove', 'wipe']) and any(t in msg_lower for t in ['task', 'todo', 'schedule', 'reminder']):
            if 'completed' in msg_lower or 'done' in msg_lower or 'finished' in msg_lower:
                updated_tasks = [t for t in updated_tasks if not t.get("completed")]
                reply = "I have successfully cleared all completed tasks from your planner."
                log_agent_thought("ChatAgent", "Action", "Local Parser: Clear completed tasks.", state)
            else:
                updated_tasks = []
                reply = "Done! I have cleared all tasks from your planner."
                log_agent_thought("ChatAgent", "Action", "Local Parser: Clear all tasks.", state)
            reminder_created = True
            
        # Look for reminder phrases, supporting spelling variations like "remainder"
        local_match = re.search(r'(?:remind\s+(?:me\s+)?to|reminder\s+to|remainder\s+to|schedule|create\s+task|give\s+me\s+(?:a\s+)?(?:reminder|remainder)\s+to)\s+(.+?)(?:\s+(?:tomorrow|today|at|on)\s+.*)?$', msg, re.IGNORECASE)
        if local_match:
            task_title = local_match.group(1).strip()
            
            # Remove time specifications from title if they got caught
            task_title = re.sub(r'\s+at\s+.*$', '', task_title, flags=re.IGNORECASE).strip()
            task_title = re.sub(r'\s+today.*$', '', task_title, flags=re.IGNORECASE).strip()
            task_title = re.sub(r'\s+tomorrow.*$', '', task_title, flags=re.IGNORECASE).strip()
            
            # Default time target: tomorrow at 10 AM
            target_dt = datetime.datetime.now()
            
            # Check if time is specified (e.g. "at 1.31 pm", "at 1:30")
            time_match = re.search(r'at\s+(\d+)(?:[:\.](\d+))?\s*(pm|am)?', msg_lower)
            if time_match:
                hr = int(time_match.group(1))
                mn = int(time_match.group(2)) if time_match.group(2) else 0
                period = time_match.group(3)
                
                if period == 'pm' and hr < 12:
                    hr += 12
                elif period == 'am' and hr == 12:
                    hr = 0
                    
                target_dt = target_dt.replace(hour=hr, minute=mn, second=0, microsecond=0)
                
                # Adjust day if "tomorrow"
                if "tomorrow" in msg_lower:
                    target_dt += datetime.timedelta(days=1)
                # If calculated time is in the past for today, schedule it for tomorrow
                elif target_dt < datetime.datetime.now() and "today" not in msg_lower:
                    target_dt += datetime.timedelta(days=1)
            else:
                target_dt = target_dt + datetime.timedelta(days=1)
                target_dt = target_dt.replace(hour=10, minute=0, second=0, microsecond=0)
                
            task_deadline = target_dt.isoformat() + "Z"
            
            log_agent_thought("ChatAgent", "Action", f"Local Regex parsed reminder. Scheduling '{task_title}' for {task_deadline}", state)
            
            new_task = {
                "id": f"task-rem-{int(datetime.datetime.now().timestamp())}",
                "title": task_title,
                "deadline": task_deadline,
                "duration": 60,
                "difficulty": "medium",
                "category": "life",
                "completed": False,
                "subtasks": [
                    {"id": f"sub-rem-{int(datetime.datetime.now().timestamp())}-1", "title": "Perform reminder action", "completed": False}
                ],
                "priorityScore": 60
            }
            updated_tasks.append(new_task)
            reminder_created = True
            
            time_display = target_dt.strftime("%I:%M %p")
            day_display = "today" if target_dt.date() == datetime.date.today() else "tomorrow"
            
            reply = f"Sure! I have set a reminder and scheduled the task: '{task_title}' for {day_display} at {time_display}. You can see it in your Tasks tab."

    if not reply:
        msg_lower = msg.lower()
        if "hello" in msg_lower or "hi" in msg_lower:
            reply = "Greetings! I am Zenith, your productivity companion. Try saying 'optimize schedule' or check out the Tasks tab."
        elif "optimize" in msg_lower or "calendar" in msg_lower:
            reply = "I can optimize your day block-by-block. Just click the AI Optimize Blocks button on the Calendar tab."
        elif "task" in msg_lower or "todo" in msg_lower:
            reply = "You can add tasks from the Tasks tab. I will prioritize and auto-decompose them into manageable checklist roadmaps."
        else:
            reply = f"I hear you! I am running in local fallback mode because your API keys are missing. Let me help you manage your day locally."

    return {
        "tasks": updated_tasks,
        "chat_reply": reply,
        "logs": state["logs"]
    }


# --- Compile LangGraphs ---

# 1. Planner Graph (Planner -> Prioritizer)
planner_builder = StateGraph(AgentState)
planner_builder.add_node("planner", planner_node)
planner_builder.add_node("prioritizer", prioritizer_node)
planner_builder.add_edge(START, "planner")
planner_builder.add_edge("planner", "prioritizer")
planner_builder.add_edge("prioritizer", END)
planner_graph = planner_builder.compile()

# 2. Scheduler Graph (Scheduler -> Insights)
scheduler_builder = StateGraph(AgentState)
scheduler_builder.add_node("scheduler", scheduler_node)
scheduler_builder.add_node("insight", insight_node)
scheduler_builder.add_edge(START, "scheduler")
scheduler_builder.add_edge("scheduler", "insight")
scheduler_builder.add_edge("insight", END)
scheduler_graph = scheduler_builder.compile()

# 3. Chat Graph (Chat)
chat_builder = StateGraph(AgentState)
chat_builder.add_node("chat", chat_node)
chat_builder.add_edge(START, "chat")
chat_builder.add_edge("chat", END)
chat_graph = chat_builder.compile()

print("[Zenith AI] All LangGraph agent structures successfully compiled.")
