import requests
import json
import time
import sys

def send_message(token, channel_id, content):
    url = f"https://discord.com/api/v9/channels/{channel_id}/messages"
    headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    }
    data = {
        "content": content
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return {"success": True}
    except requests.exceptions.HTTPError as e:
        error_msg = str(e)
        if response.text:
            try:
                error_msg += f": {response.json().get('message', response.text)}"
            except:
                error_msg += f": {response.text}"
        return {"success": False, "error": error_msg}
    except Exception as e:
        return {"success": False, "error": str(e)}

def log_to_ui(data):
    """Print JSON data to stdout and flush immediately."""
    print(json.dumps(data), flush=True)

def main():
    # Read all input from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data:
            log_to_ui({"type": "error", "message": "No input received"})
            return
            
        request = json.loads(input_data)
    except json.JSONDecodeError:
        log_to_ui({"type": "error", "message": "Invalid JSON input"})
        return

    token = request.get('token')
    targets = request.get('targets', [])

    if not token:
        log_to_ui({"type": "error", "message": "Token is missing"})
        return

    log_to_ui({"type": "log", "message": f"Starting broadcast to {len(targets)} targets..."})

    total = len(targets)
    for index, target in enumerate(targets):
        channel_id = target.get('channel_id')
        role_id = target.get('role_id')
        base_text = target.get('message', '')
        
        # Report progress
        log_to_ui({
            "type": "progress",
            "current": index + 1,
            "total": total,
            "channel_id": channel_id
        })

        if not channel_id:
            log_to_ui({"type": "error", "channel_id": "unknown", "message": "Missing channel_id"})
            continue
            
        message_content = base_text
        if role_id:
            message_content = f"<@&{role_id}> {base_text}"
            
        result = send_message(token, channel_id, message_content)
        
        if result['success']:
            log_to_ui({"type": "success", "channel_id": channel_id, "message": "Sent successfully"})
        else:
            log_to_ui({"type": "error", "channel_id": channel_id, "message": result['error']})
        
        # Rate limit
        time.sleep(1)

    log_to_ui({"type": "done", "summary": "Broadcast complete"})

if __name__ == "__main__":
    main()
