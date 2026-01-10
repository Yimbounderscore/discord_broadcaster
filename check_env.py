#!/usr/bin/env python3
"""
Check Python environment for Discord Broadcaster requirements.
Outputs JSON with status information.
"""
import sys
import json

def check_environment():
    result = {
        "python_ok": False,
        "python_version": "",
        "requests_ok": False,
        "errors": []
    }
    
    # Check Python version (need 3.6+)
    version_info = sys.version_info
    result["python_version"] = f"{version_info.major}.{version_info.minor}.{version_info.micro}"
    
    if version_info.major >= 3 and version_info.minor >= 6:
        result["python_ok"] = True
    else:
        result["errors"].append(f"Python 3.6+ required. Found: {result['python_version']}")
    
    # Check for requests package
    try:
        import requests
        result["requests_ok"] = True
    except ImportError:
        result["errors"].append("Missing 'requests' package. Install with: pip install requests")
    
    return result

if __name__ == "__main__":
    result = check_environment()
    print(json.dumps(result))
