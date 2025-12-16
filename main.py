import requests
import json
import time
import os
import sys

CONFIG_FILE = 'config.json'

def load_config():
    if not os.path.exists(CONFIG_FILE):
        print(f"Error: {CONFIG_FILE} not found.")
        sys.exit(1)
    
    with open(CONFIG_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            print(f"Error: Failed to parse {CONFIG_FILE}.")
            sys.exit(1)

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
        print(f"Success: Message sent to channel {channel_id}")
    except requests.exceptions.HTTPError as e:
        print(f"Failed to send message to {channel_id}: {e}")
        if response.text:
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

def main():
    print("Discord Message Broadcaster")
    print("---------------------------")
    
    token = input("Enter your Discord User Token: ").strip()
    if not token:
        print("Error: Token cannot be empty.")
        return
    
    config = load_config()
    
    print(f"\nFound {len(config)} targets in config.")
    
    for entry in config:
        channel_id = entry.get('channel_id')
        role_id = entry.get('role_id')
        base_text = entry.get('message_text', '')
        
        if not channel_id:
            print("Skipping entry: Missing channel_id")
            continue
            
        # Construct message content
        # If role_id is present, format it as a mention
        message_content = base_text
        if role_id:
            message_content = f"<@&{role_id}> {base_text}"
            
        print(f"Sending to channel {channel_id}...")
        send_message(token, channel_id, message_content)
        
        # Avoid rate limits
        time.sleep(1)

if __name__ == "__main__":
    main()
