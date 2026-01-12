import requests
import json
import time
import sys
import os


def send_message(token, channel_id, content, image_path=None):
    url = f"https://discord.com/api/v9/channels/{channel_id}/messages"
    headers = {
        "Authorization": token
    }
    data = {
        "content": content
    }

    response = None
    try:
        if image_path:
            filename = os.path.basename(image_path)
            payload = {"payload_json": json.dumps(data)}
            with open(image_path, "rb") as image_file:
                files = {"files[0]": (filename, image_file)}
                response = requests.post(url, headers=headers, data=payload, files=files)
        else:
            headers["Content-Type"] = "application/json"
            response = requests.post(url, headers=headers, json=data)

        response.raise_for_status()
        return {"success": True}
    except requests.exceptions.HTTPError as e:
        error_msg = str(e)
        if response is not None and response.text:
            try:
                error_msg += f": {response.json().get('message', response.text)}"
            except Exception:
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
    is_preview = request.get('preview', False)

    if not token:
        log_to_ui({"type": "error", "message": "Token is missing"})
        return

    mode_label = "PREVIEW" if is_preview else "broadcast"
    log_to_ui({"type": "log", "message": f"Starting {mode_label} to {len(targets)} targets..."})

    total = len(targets)
    success_count = 0
    error_count = 0
    
    for index, target in enumerate(targets):
        channel_id = target.get('channel_id')
        role_id = target.get('role_id')
        base_text = target.get('message', '')
        image_path = target.get('image_path', '').strip()
        target_name = target.get('name', '') or f"Target #{index + 1}"
        
        # Report progress
        log_to_ui({
            "type": "progress",
            "current": index + 1,
            "total": total,
            "channel_id": channel_id,
            "name": target_name
        })

        if not channel_id:
            log_to_ui({"type": "error", "channel_id": "unknown", "name": target_name, "message": "Missing channel_id"})
            error_count += 1
            continue
            
        message_content = base_text
        if role_id:
            message_content = f"<@&{role_id}> {base_text}"
        
        if is_preview:
            # Preview mode: just log what would happen
            preview_note = f"[PREVIEW] Would send: {message_content[:50]}..."
            if image_path:
                preview_note += " with image"
            log_to_ui({"type": "success", "channel_id": channel_id, "name": target_name, "message": preview_note})
            success_count += 1
        else:
            # Actual broadcast
            result = send_message(token, channel_id, message_content, image_path=image_path)
            
            if result['success']:
                log_to_ui({"type": "success", "channel_id": channel_id, "name": target_name, "message": "Sent successfully"})
                success_count += 1
            else:
                log_to_ui({"type": "error", "channel_id": channel_id, "name": target_name, "message": result['error']})
                error_count += 1
            
            # Rate limit only for actual sends
            time.sleep(1)

    summary = f"{mode_label.title()} complete: {success_count} successful, {error_count} failed"
    log_to_ui({"type": "done", "summary": summary})

if __name__ == "__main__":
    main()
