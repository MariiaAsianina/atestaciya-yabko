#!/usr/bin/env python3
"""Download the attestation .xlsx from Firebase Storage into data/.

Configuration via environment variables:
  FIREBASE_STORAGE_BUCKET    - e.g. "atestaciya-yabko.appspot.com"
  FIREBASE_FILE_PATH         - path of the file inside the bucket, e.g. "Атестація Літо 2026.xlsx"
  FIREBASE_CREDENTIALS_JSON  - full service-account JSON as a string (used in CI)
  FIREBASE_CREDENTIALS_FILE  - path to a service-account JSON file (used locally)
"""
import os, sys, json

from google.cloud import storage
from google.oauth2 import service_account

BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET')
SOURCE_PATH = os.environ.get('FIREBASE_FILE_PATH', 'Атестація Літо 2026.xlsx')
CRED_JSON = os.environ.get('FIREBASE_CREDENTIALS_JSON')
CRED_FILE = os.environ.get('FIREBASE_CREDENTIALS_FILE')

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'Атестація Літо 2026.xlsx')

def main():
    if not BUCKET:
        print('ERROR: FIREBASE_STORAGE_BUCKET не задано.', file=sys.stderr)
        sys.exit(1)

    if CRED_JSON:
        creds = service_account.Credentials.from_service_account_info(json.loads(CRED_JSON))
    elif CRED_FILE:
        if not os.path.exists(CRED_FILE):
            print(f'ERROR: файл ключа не знайдено: {CRED_FILE}', file=sys.stderr)
            sys.exit(1)
        creds = service_account.Credentials.from_service_account_file(CRED_FILE)
    else:
        print('ERROR: не задано FIREBASE_CREDENTIALS_JSON або FIREBASE_CREDENTIALS_FILE.', file=sys.stderr)
        sys.exit(1)

    client = storage.Client(credentials=creds, project=creds.project_id)
    bucket = client.bucket(BUCKET)
    blob = bucket.blob(SOURCE_PATH)
    if not blob.exists():
        print(f'ERROR: файл "{SOURCE_PATH}" не знайдено у Storage bucket "{BUCKET}".', file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    blob.download_to_filename(DEST)
    print(f'Завантажено "{SOURCE_PATH}" -> {DEST} ({blob.size} байт)', file=sys.stderr)

if __name__ == '__main__':
    main()
