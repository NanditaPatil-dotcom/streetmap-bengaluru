# StreetMap Bengaluru - Time-Aware Community Map for Bengaluru

## Overview

StreetMap Bengaluru is a community-driven, time-aware mapping platform designed to help users discover places in Bengaluru based on what they want, where they are, and what time it is.

It enhances traditional maps by introducing contextual, time-based discovery and local insights.

---

## Problem Statement

Users often struggle to find relevant places at specific times of the day due to:

- Inaccurate or outdated timings
- Lack of time-based filtering
- Poor visibility of local and niche spots
- Static map experiences

---

## Solution

StreetMap Bengaluru provides:

- Time-based discovery (morning, noon, evening, night)  
- Category-based maps (cafes, parks, metro, BMTC)  
- Location and tag-based filtering  
- Community-driven place contributions  

Also, it intends to provide the functionality for users to find places and leave 

---

## Core Concept

The system is structured around three dimensions:

WHAT → Navbar (Map Type)  
WHERE → Sidebar Filters  
WHEN → Footer Modes  

---

## Features

### Map Interface
- Interactive map using Leaflet  
- Dynamic markers with popups  

### Map Layers (Navbar)
- Normal Map  
- Cafe Map  
- Park Map  
- Metro Map  
- BMTC Map  

### Time Modes (Footer)
- Morning: breakfast, parks, gyms  
- Noon: lunch, workspaces  
- Evening: snacks, bakeries  
- Night: dinner, nightlife  

### Filters
- Area  
- Category  
- Open Now  
- Tags  

### Community Features
- Add places  
- Add tags and descriptions

### Community Layer (In Progress)
We are building a social layer on top of the map where users can leave comments,
recommendations, photos, and short videos tied to specific places. The goal is to
turn each place entry into a living discussion thread — part review platform, part
local forum. Think of it as community-sourced ground truth for a city, where
regulars can share things that never make it onto Google Maps: the best seat in
a café, which hours to avoid, or a hidden entrance to a park.

### Mood-Based Recommendation Engine (Planned)
We are working on a lightweight recommendation engine that takes user-defined
inputs — mood, energy level, preferred vibe, time of day — and surfaces relevant
places including lesser-known spots that would otherwise not appear in standard
searches. The intent is to move beyond category filters and into intent-aware
discovery, so the map can answer questions like "I want somewhere quiet and
green, post-lunch, near Koramangala" without the user needing to manually
configure every filter.

### Verified Local Contributions
A structured way for locals and regulars to submit edits, flag outdated timings,
and add context that static data sources miss. Contributions will be
community-reviewed before going live.

### Activity Signals
Surface real-time or historically-derived signals like crowd levels, typical wait
times, and best-visit windows — sourced from community input rather than
proprietary APIs, keeping the project fully open.

---

## Tech Stack

### Frontend
- Next.js  
- React  
- Tailwind CSS  
- MapLibre  

### Backend
- Next.js API Routes  

### Database
- MongoDB (Mongoose)  

### Maps
- OpenStreetMap  

---

## Data Model

```json
{
  "name": "CTR Malleshwaram",
  "category": "cafe",
  "location": {
    "type": "Point",
    "coordinates": [77.5706, 12.9916]
  },
  "area": "malleshwaram",
  "tags": ["breakfast", "dosa"],
  "openTime": "07:00",
  "closeTime": "11:00",
  "description": "Best benne dosa"
}
```

---

## API Endpoints

```
GET /api/places
```

### Supported Filters

```
/api/places?category=cafe
/api/places?mode=morning
/api/places?area=indiranagar
/api/places?openNow=true
```

---

## Development Progress

Day 1–2  
- Project setup  
- Map rendering  

Day 3  
- Database schema  
- API setup  
- Starter dataset  

Day 4  
- Marker rendering  
- Popups  

Day 5  
- Filters  
- Category switching  

Day 6  
- Time-based modes  

Day 7  
- UI improvements  
- Testing  

---

## Unique Value

StreetMap Bengaluru introduces time-aware mapping, enabling users to explore the city based on real-world usage patterns rather than static data.

---

## Future Scope

- User reviews and ratings  
- Real-time activity indicators  
- AI-based recommendations  
- Transit integration  

---

## Contributors

- Nandita — Frontend, Backend, Database, Map UI  
- Amrita — Backend, Database, APIs

---

## Conclusion

StreetMap Bengaluru transforms static maps into a dynamic, community-driven discovery platform tailored to how people actually experience a city.
