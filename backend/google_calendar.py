import os
import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/calendar']

# Paths resolved relative to this file's folder to support multi-directory launches
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BASE_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BASE_DIR, 'token.json')

# Concurrency lock to prevent duplicate browser oauth tabs in React StrictMode
is_authenticating = False

def get_calendar_service():
    """
    Authenticates the user and returns the Google Calendar API service object.
    Returns None if credentials.json is missing or authentication fails.
    """
    global is_authenticating
    creds = None

    # 1. Try loading from environment variable (recommended for production/Render)
    env_token = os.environ.get("GOOGLE_CALENDAR_TOKEN")
    if env_token:
        try:
            import json
            token_info = json.loads(env_token)
            creds = Credentials.from_authorized_user_info(token_info, SCOPES)
            print("[Google Calendar] Successfully loaded credentials from GOOGLE_CALENDAR_TOKEN environment variable.")
        except Exception as e:
            print(f"[Google Calendar] Error loading credentials from GOOGLE_CALENDAR_TOKEN env: {e}")

    # 2. Try loading from token.json file
    if not creds and os.path.exists(TOKEN_PATH):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        except Exception as e:
            print(f"[Google Calendar] Error loading token.json: {e}")

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                # Only write to disk if the directory is writable
                if os.access(os.path.dirname(TOKEN_PATH), os.W_OK):
                    with open(TOKEN_PATH, 'w') as token:
                        token.write(creds.to_json())
            except Exception as e:
                print(f"[Google Calendar] Error refreshing credentials: {e}")
                creds = None
        
        # If still no valid credentials, check for credentials.json to initiate OAuth
        if not creds:
            if not os.path.exists(CREDENTIALS_PATH):
                print(f"[Google Calendar] credentials.json not found at {CREDENTIALS_PATH}. Calendar Sync is disabled.")
                return None
            
            # CRITICAL: Prevent hanging/crashing in headless production environments like Render
            is_headless = os.environ.get("RENDER") == "true"
            if is_headless:
                print("[Google Calendar] Headless/Production environment detected. Skipping interactive browser OAuth flow.")
                return None

            if is_authenticating:
                print("[Google Calendar] Authentication already in progress. Skipping duplicate browser tab request.")
                return None
                
            is_authenticating = True
            try:
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
                # Running local server for authentication
                creds = flow.run_local_server(port=0)
                # Save the credentials for the next run
                with open(TOKEN_PATH, 'w') as token:
                    token.write(creds.to_json())
            except Exception as e:
                print(f"[Google Calendar] Authentication flow failed: {e}")
                return None
            finally:
                is_authenticating = False

    try:
        service = build('calendar', 'v3', credentials=creds)
        return service
    except Exception as e:
        print(f"[Google Calendar] Failed to build calendar service: {e}")
        return None

def sync_events_to_google_calendar(blocks):
    """
    Syncs the list of calendar blocks into the user's Google Calendar.
    First, it removes any existing events marked with '[Zenith Timeblock]' to avoid duplicates,
    then writes the new blocks.
    """
    service = get_calendar_service()
    if not service:
        print("[Google Calendar] Service not available. Sync skipped.")
        return False

    try:
        # Get the timezone of the primary calendar
        try:
            calendar = service.calendars().get(calendarId='primary').execute()
            user_timezone = calendar.get('timeZone', 'UTC')
            print(f"[Google Calendar] Detected user timezone: {user_timezone}")
        except Exception as e:
            print(f"[Google Calendar] Error getting calendar timezone, defaulting to UTC: {e}")
            user_timezone = 'UTC'

        # 1. Fetch events to find and delete existing Zenith blocks for the current week
        today = datetime.date.today()
        monday = today - datetime.timedelta(days=today.weekday())
        sunday = monday + datetime.timedelta(days=6)
        
        # Query slightly wider to handle timezone differences
        time_min_dt = datetime.datetime.combine(monday, datetime.time.min) - datetime.timedelta(days=1)
        time_max_dt = datetime.datetime.combine(sunday, datetime.time.max) + datetime.timedelta(days=1)
        
        time_min = time_min_dt.isoformat() + 'Z'
        time_max = time_max_dt.isoformat() + 'Z'
        
        print("[Google Calendar] Scanning for existing Zenith blocks in the current week...")
        events_result = service.events().list(
            calendarId='primary', 
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        for event in events:
            # Check if event was created by Zenith
            if '[Zenith Timeblock]' in event.get('description', ''):
                event_id = event['id']
                print(f"[Google Calendar] Deleting outdated block: {event.get('summary')}")
                service.events().delete(calendarId='primary', eventId=event_id).execute()

        # 2. Insert new blocks
        for block in blocks:
            # Skip recharge breaks on Google calendar if they clutter the view
            if "guided recharge break" in block['title'].lower():
                continue

            # Calculate actual ISO start and end times
            # block['dayOfWeek']: 1 = Monday, 7 = Sunday
            # block['startHour']: e.g., 9.5
            col_offset = block['dayOfWeek'] - 1
            event_date = monday + datetime.timedelta(days=col_offset)
            
            # Start time calculation
            start_hour_int = int(block['startHour'])
            start_min_int = int((block['startHour'] - start_hour_int) * 60)
            start_dt = datetime.datetime.combine(event_date, datetime.time(start_hour_int, start_min_int))
            
            # End time calculation
            duration_hours = block['durationHours']
            end_dt = start_dt + datetime.timedelta(hours=duration_hours)

            event_body = {
                'summary': f"⚡ {block['title']}",
                'description': f"Optimized by Zenith AI Companion. Category: {block['category']}. [Zenith Timeblock]",
                'start': {
                    'dateTime': start_dt.isoformat(),
                    'timeZone': user_timezone,
                },
                'end': {
                    'dateTime': end_dt.isoformat(),
                    'timeZone': user_timezone,
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'popup', 'minutes': 10},
                    ],
                },
            }

            created_event = service.events().insert(calendarId='primary', body=event_body).execute()
            print(f"[Google Calendar] Created event: {created_event.get('htmlLink')}")

        return True
    except HttpError as error:
        print(f"[Google Calendar] API error during sync: {error}")
        return False
    except Exception as e:
        print(f"[Google Calendar] Error during sync: {e}")
        return False

def get_external_calendar_events():
    """
    Fetches non-Zenith events from the user's primary Google Calendar
    for the current week (Monday to Sunday), formatting them for Zenith's calendar display.
    """
    service = get_calendar_service()
    if not service:
        return []

    try:
        # Calculate current week's Monday and Sunday
        today = datetime.date.today()
        monday = today - datetime.timedelta(days=today.weekday())
        sunday = monday + datetime.timedelta(days=6)
        
        # Query GCal from Monday 00:00:00 to Sunday 23:59:59
        # Query slightly wider to handle timezone differences
        time_min_dt = datetime.datetime.combine(monday, datetime.time.min) - datetime.timedelta(days=1)
        time_max_dt = datetime.datetime.combine(sunday, datetime.time.max) + datetime.timedelta(days=1)
        
        time_min = time_min_dt.isoformat() + 'Z'
        time_max = time_max_dt.isoformat() + 'Z'
        
        print(f"[Google Calendar] Fetching external events between {time_min} and {time_max}...")
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        external_blocks = []
        
        for event in events:
            # Skip events created by Zenith
            if '[Zenith Timeblock]' in event.get('description', ''):
                continue
                
            start = event['start'].get('dateTime') or event['start'].get('date')
            end = event['end'].get('dateTime') or event['end'].get('date')
            
            if not start or not end:
                continue
                
            try:
                if 'T' in start:
                    dt_start = datetime.datetime.strptime(start[:19], "%Y-%m-%dT%H:%M:%S")
                    dt_end = datetime.datetime.strptime(end[:19], "%Y-%m-%dT%H:%M:%S")
                else:
                    dt_start = datetime.datetime.strptime(start, "%Y-%m-%d")
                    dt_end = datetime.datetime.strptime(end, "%Y-%m-%d")
            except Exception as e:
                print(f"[Google Calendar] Error parsing event time: {e}")
                continue

            # Python-side filtering: only include events within the current week (Monday to Sunday) in local time
            event_date = dt_start.date()
            if not (monday <= event_date <= sunday):
                continue

            day_of_week = dt_start.isoweekday()
            
            start_hour_float = dt_start.hour + (dt_start.minute / 60.0)
            duration_hours = (dt_end - dt_start).total_seconds() / 3600.0
            
            def format_time(h, m):
                period = 'PM' if h >= 12 else 'AM'
                display_h = h - 12 if h > 12 else h
                display_h = 12 if display_h == 0 else display_h
                return f"{display_h:02d}:{m:02d} {period}"

            external_blocks.append({
                "taskId": f"gcal-ext-{event.get('id')}",
                "title": f"📅 {event.get('summary', 'Untitled Event')}",
                "category": "study", # Styling option
                "startTimeStr": format_time(dt_start.hour, dt_start.minute),
                "endTimeStr": format_time(dt_end.hour, dt_end.minute),
                "startHour": start_hour_float,
                "durationHours": max(0.5, duration_hours),
                "dayOfWeek": day_of_week
            })
            
        return external_blocks
    except Exception as e:
        print(f"[Google Calendar] Failed to fetch external events: {e}")
        return []
