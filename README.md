# Pac-Man Pathfinding Algorithm Comparison

A full-stack web application that visualizes and benchmarks different pathfinding algorithms (BFS, DFS, Dijkstra's, A*) in classic Pac-Man maze environments.

**Author:** Rune Røddik Hansen (ruha0001)

## 🎮 Features

### Frontend (Browser-based)
- **Classic Pac-Man Maze**: Authentic maze layout from the original game
- **4 Pathfinding Algorithms**: BFS, DFS, Dijkstra's, and A* with Manhattan heuristic
- **Real-time Visualization**: See how each algorithm explores the maze
- **Multiple Maps**: Classic, Open Arena, and Dense Maze
- **Performance Benchmarking**: Compare algorithms quantitatively
- **Interactive Controls**: Play, pause, step-through, and configure each ghost
- **Client-side Computing**: All pathfinding runs in your browser for maximum performance

### Backend (Node.js/Express)
- **Benchmark Storage**: Save and retrieve historical benchmark results
- **Analytics Dashboard**: Aggregate statistics across all benchmarks
- **Custom Map Management**: Save and load custom maze configurations
- **CSV Export**: Export benchmark data for external analysis
- **RESTful API**: Clean, documented endpoints

## 🏗️ Architecture
```
Frontend (HTML/Canvas/JavaScript)
    ↓ Pathfinding (Client-side)
    ↓ REST API (Data only)
Backend (Node.js/Express)
    ↓ JSON File Storage
Data Persistence (benchmarks.json, maps.json)
```

## 📦 Installation

### Prerequisites
- Node.js 16+
- npm or yarn

### Setup

1. **Clone or create the project structure:**
```bash
mkdir pacman-pathfinding
cd pacman-pathfinding
mkdir backend frontend
```

2. **Set up backend:**
```bash
cd backend
npm init -y
npm install express cors dotenv
npm install --save-dev nodemon
```

3. **Create backend files:**
- Create `server.js` with the provided code
- Create `.env` file

4. **Set up frontend:**
- Copy the HTML artifact into `frontend/index.html`

5. **Start the server:**
```bash
cd backend
npm start
```

6. **Open your browser:**
```
http://localhost:3000
```

## 🚀 Usage

### Frontend Controls

- **Play/Pause**: Start or stop the simulation
- **Step**: Advance simulation by one tick
- **Reset**: Return all ghosts to starting positions
- **Benchmark**: Run automated performance tests
- **Speed Slider**: Adjust simulation speed (50-1000ms per tick)
- **Maps**: Switch between different maze layouts
- **Ghost Controls**: Change algorithm for each ghost individually
- **Show Path**: Visualize a specific ghost's pathfinding process

### API Endpoints

#### POST /api/benchmarks
Save benchmark results to server.

**Request:**
```json
{
  "mapName": "classic",
  "results": [...],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "id": "1705315800000",
  "message": "Benchmark saved successfully"
}
```

#### GET /api/benchmarks
Retrieve benchmark results.

**Query Parameters:**
- `mapName` (optional): Filter by map name
- `limit` (optional): Max results to return (default: 50)

**Response:**
```json
[
  {
    "id": "1705315800000",
    "mapName": "classic",
    "results": [...],
    "timestamp": "2024-01-15T10:30:00.000Z",
    "userAgent": "..."
  }
]
```

#### GET /api/benchmarks/stats
Get aggregate statistics across all benchmarks.

**Response:**
```json
{
  "totalBenchmarks": 42,
  "algorithms": {
    "BFS": {
      "totalRuns": 42,
      "avgTime": 0.523,
      "avgNodes": 145.2,
      "avgTicks": 28.5,
      "avgCatchRate": 0.95
    },
    ...
  },
  "maps": {
    "classic": {
      "count": 20,
      "algorithms": {...}
    }
  }
}
```

#### GET /api/export/benchmarks
Export all benchmarks as CSV file.

**Response:** CSV file download

#### POST /api/maps
Save a custom map configuration.

#### GET /api/maps
Retrieve all saved custom maps.

#### DELETE /api/benchmarks/:id
Delete a specific benchmark by ID.

## 🧠 Algorithms

### BFS (Breadth-First Search) - FIXED
- **Strategy**: Level-by-level exploration
- **Data Structure**: Queue (FIFO)
- **Guarantees**: Shortest path
- **Time Complexity**: O(V + E)
- **Space Complexity**: O(V)

### DFS (Depth-First Search) - FIXED
- **Strategy**: Explore as deep as possible first
- **Data Structure**: Stack (LIFO)
- **Fix Applied**: Now marks nodes as visited when added to stack (not when popped)
- **Characteristics**: No more infinite loops between two nodes!
- **Time Complexity**: O(V + E)
- **Space Complexity**: O(V) worst case

**DFS Fix Explanation:**
The original DFS had a bug where it would mark nodes as visited only after popping from the stack. This caused it to add the same node multiple times, leading to inefficient back-and-forth movement. The fix marks nodes as visited immediately when adding them to the stack, preventing revisits.

### Dijkstra's Algorithm
- **Strategy**: Greedy shortest path with costs
- **Data Structure**: Priority queue
- **Guarantees**: Optimal for weighted graphs
- **Time Complexity**: O((V + E) log V)
- **Space Complexity**: O(V)

### A* (A-Star)
- **Strategy**: Heuristic-guided search
- **Heuristic**: Manhattan distance
- **Data Structure**: Priority queue (f-score)
- **Guarantees**: Optimal with admissible heuristic
- **Time Complexity**: O(b^d) worst case, often much better
- **Space Complexity**: O(V)

## 📊 Backend Purpose

The backend serves four main purposes:

1. **Data Persistence**: Store benchmark results across sessions
2. **Analytics**: Aggregate statistics and trends over time
3. **Collaboration**: Share benchmark results between users
4. **Export**: Generate CSV files for academic analysis

**Why not pathfinding in backend?**
- Pathfinding is computationally intensive
- Better performance running client-side (no network latency)
- Scales better (each client uses their own CPU)
- Backend focuses on what it does best: data management

## 🔧 Development

### Project Structure
```
pacman-pathfinding/
├── frontend/
│   └── index.html          # Single-page application with algorithms
├── backend/
│   ├── server.js           # Express server (data & API)
│   ├── data/
│   │   ├── benchmarks.json # Stored benchmark results
│   │   └── maps.json       # Custom maps
│   ├── package.json
│   └── .env
├── README.md
└── EVALUATION.md
```

### Scripts
```bash
npm start          # Start production server
npm run dev        # Start with nodemon (auto-reload)
```

### Environment Variables
```env
PORT=3000
NODE_ENV=development
```

## 🧪 Testing API
```bash
# Health check
curl http://localhost:3000/api/health

# Get benchmarks
curl http://localhost:3000/api/benchmarks

# Get statistics
curl http://localhost:3000/api/benchmarks/stats

# Export CSV
curl http://localhost:3000/api/export/benchmarks --output benchmarks.csv
```

## 📝 Future Enhancements

- [ ] WebSocket for real-time multi-user competitions
- [ ] User authentication and personal leaderboards
- [ ] Database migration (SQLite/PostgreSQL)
- [ ] Chart visualizations on backend dashboard
- [ ] Map editor in frontend
- [ ] Additional algorithms (JPS, Theta*, IDA*)
- [ ] Machine learning analysis of algorithm performance

## 🐛 Known Issues & Fixes

- ✅ **FIXED**: DFS infinite loops - now properly tracks visited nodes
- ✅ **IMPROVED**: All pathfinding runs client-side for better performance
- Minor: Ghosts can overlap in same cell
- Minor: Large benchmarks slow down page load (pagination needed)

## 📄 License

MIT License

## 👤 Author

Rune Røddik Hansen (ruha0001)

## 🙏 Acknowledgments

- Original Pac-Man game by Namco
- Pathfinding algorithm research community