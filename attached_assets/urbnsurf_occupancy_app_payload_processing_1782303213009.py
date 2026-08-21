import pandas as pd

import json
from pathlib import Path
from collections import Counter

import os

from datetime import date, timedelta

import requests

##################################################
## Get today and tomorrow's dates. These are the dates that will be updated on refresh

# today
today_date = date.today().strftime("%Y-%m-%d")

# tomorrow
tomorrow_date = (
    date.today() + timedelta(days=1)
).strftime("%Y-%m-%d")

from_date = today_date # "2026-06-17"
to_date = tomorrow_date

payload_name = 'payload_'+from_date+'to'+to_date+'.json'
# print(payload_name)

##################################################
## Get the api request for the payload for today

url = (
    "https://hm42z09myi.execute-api.ap-southeast-2.amazonaws.com"
    "/prod/sessions/v1/availability"
)

params = {
    "location": "melbourne",
    "from_date": from_date,
    "to_date": from_date,
    "page": 1,
    "limit": 600
}
response_today = requests.get(url, params=params)
payload_data_today = response_today.json()

## Get the api request for the payload for tomorrow
params = {
    "location": "melbourne",
    "from_date": to_date,
    "to_date": to_date,
    "page": 1,
    "limit": 600
}
response_tomorrow = requests.get(url, params=params)
payload_data_tomorrow = response_tomorrow.json()

# merge two days
payload_data = (
    payload_data_today["data"]
    + payload_data_tomorrow["data"]
)

##################################################
# Note trying to both today and tomorrow at the same time results in tomorrow cutting off mid-day

##################################################
## Process the payload into a dataframe, only extracting essential data

rows = []

# Replace payload_data["sessions"] with the correct top-level list if needed
# for session in payload_data["data"]:
for session in payload_data:

# Only keep certain sessions
#     if session.get("session_type") == "progressive-turns" and session.get("time") == "10:00":

    row = {
#       "session_id": session.get("session_id"),
        "date": session.get("date"),
        "time": session.get("time"),
        "title": session.get("title"),
        #"name": session.get("name"),
        "wave_direction": session.get("wave_direction"),
        "code": session.get("code"),
        "description": session.get("description"),
        "event_code": session.get("event_code"),
#       "session_type": session.get("session_type"),
#       "skill_level": session.get("skill_level"),
        "capacity_total": session.get("capacity", {}).get("total"),
        "capacity_available": session.get("capacity", {}).get("available")
    }

    rows.append(row)

# Create dataframe
df = pd.DataFrame(rows)

# Optional: calculate booked spots
df["capacity_booked"] = (
    df["capacity_total"] - df["capacity_available"]
)

##################################################
## Remove redundant data

# ignore rows where these codes are listed
ignore_codes = ('M-GENAD', 'M-BAYS-SL', 'M-SBUD-LEFT', 'M-SBUD-RIGHT', 'M-SBUD-B', 'M-BAYS-S',
    'M-BAYS-GL', 'M-BAYS-PL', 'M-BAYS-5WK', 'M-SBUD-L', 'M-BAYS-RL', 'M-BAYS-SL', 'M-RIP-GL', 'M-RIP-5WK')

df = df[~df["code"].isin(ignore_codes)]

##################################################
## Aggregate capacity_available/capacity_booked is only needed because of holding coaching spots

df_grouped = (
    df.groupby(
        [
            "date",
            "time",
            "title",
            "wave_direction"
        ],
        as_index=False
    )
    .agg(
        {
            "capacity_booked": "sum",
            "capacity_available": "sum"
        }
    )
)

##################################################
## Output file for exploring the full data payload

# output_file_name = payload_name[:16]+"_processed.csv"
# output_path = Path.cwd() / output_file_name
# df.to_csv(output_path, index=False)

##################################################
## Output file for upload to Wave Occupancy App

output_file_name_agg = payload_name[:18]+"_processed_agg.csv"
output_path = Path.cwd() / output_file_name_agg
df_grouped.to_csv(output_path, index=False)
# print(output_file_name_agg)

##################################################
##  colour map reference

# Roller: rgb(51, 117, 125)
# Cruiser: rgb(70, 190, 176)
# Progressive Turns: rgb(51, 117, 125)
# Intermediate: rgb(69, 124, 175)
# Intermediate Plus: rgb(62, 60, 60)
# Intermediate Barrels: rgb(155, 223, 234)
# Advanced Turns: rgb(210, 175, 255)
# Pro Turns: rgb(255, 150, 145)
# Advanced: rgb(246, 180, 64)
# Expert: rgb(255, 150, 145)
# Boogie Nights: rgb(60, 176, 67)

##################################################
