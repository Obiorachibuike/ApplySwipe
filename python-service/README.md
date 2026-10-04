# ApplySwipe Python Automation Service

This microservice provides:
- ATS (Greenhouse, Lever, Workday) API connection management
- Resume text entity extraction
- Legal submission payload validation
- Background batch ingestion

## Local Run
```bash
cd python-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 main.py
```
Runs at `http://0.0.0.0:8000`
