# Pac-Man Pathfinding Algorithm Comparison

A full-stack web application that visualizes and benchmarks different pathfinding algorithms (BFS, DFS, Dijkstra's, A\*) in a classic Pac-Man maze environment.

**Author:** Rune Røddik Hansen (ruha0001)

## 🎮 Features

- **Classic Pac-Man Maze**: Authentic maze layout from the original game
- **4 Pathfinding Algorithms**: BFS, DFS, Dijkstra's, and A\* with Manhattan heuristic
- **Real-time Visualization**: See how each algorithm explores the maze
- **Performance Benchmarking**: Compare algorithms quantitatively
- **Interactive Controls**: Play, pause, step-through, and configure each ghost
- **RESTful API**: Backend provides pathfinding as a service

## 🏗️ Architecture

```
Frontend (HTML/CSS/JavaScript)
         ↓ HTTP/REST
Backend (Node.js/Express)
         ↓
  Pathfinding Algorithms
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
```

2. **Create backend directory:**

```bash
mkdir backend
cd backend
```

3. **Initialize and install dependencies:**

```bash
npm install
```

4. **Create frontend directory:**

```bash
cd ..
mkdir frontend
# Copy the index.html artifact into this folder
```

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
- **Ghost Controls**: Change algorithm for each ghost individually
- **Show Path**: Visualize a specific ghost's pathfinding process

### API Endpoints

#### POST /api/pathfind

Execute a single pathfinding operation.

**Request:**

```json
{
  "start": { "x": 1, "y": 1 },
  "goal": { "x": 14, "y": 23 },
  "maze": [[1, 0, 0, ...], ...],
  "algorithm": "A*",
  "ghosts": [{ "x": 5, "y": 5 }]
}
```

**Response:**

```json
{
  "nextMove": { "x": 2, "y": 1 },
  "visited": [{ "x": 1, "y": 1 }, ...],
  "frontier": [{ "x": 3, "y": 1 }, ...],
  "path": [{ "x": 1, "y": 1 }, ...],
  "nodesVisited": 45,
  "timeMs": 1.234
}
```

#### POST /api/benchmark

Run comprehensive benchmark tests.

**Request:**

```json
{
  "maze": [[1, 0, 0, ...], ...],
  "trials": 10
}
```

**Response:**

```json
[
  {
    "algorithm": "BFS",
    "avgTimeMs": 0.5234,
    "avgNodesVisited": 42.3,
    "avgTicksToCatch": 28.5,
    "catchRate": 1.0,
    "trials": 10
  },
  ...
]
```

#### GET /api/health

Health check endpoint.

## 🧠 Algorithms

### BFS (Breadth-First Search)

- **Strategy**: Level-by-level exploration
- **Data Structure**: Queue (FIFO)
- **Guarantees**: Shortest path
- **Time Complexity**: O(V + E)
- **Space Complexity**: O(V)

### DFS (Depth-First Search)

- **Strategy**: Explore as deep as possible first
- **Data Structure**: Stack (LIFO)
- **Characteristics**: May find longer paths
- **Time Complexity**: O(V + E)
- **Space Complexity**: O(V) worst case, O(h) average

### Dijkstra's Algorithm

- **Strategy**: Greedy shortest path with costs
- **Data Structure**: Priority queue
- **Guarantees**: Optimal for weighted graphs
- **Time Complexity**: O((V + E) log V)
- **Space Complexity**: O(V)

### A\* (A-Star)

- **Strategy**: Heuristic-guided search
- **Heuristic**: Manhattan distance
- **Data Structure**: Priority queue (f-score)
- **Guarantees**: Optimal with admissible heuristic
- **Time Complexity**: O(b^d) worst case, often better in practice
- **Space Complexity**: O(V)

## 📊 Benchmarking

The benchmark system runs multiple trials to compare:

1. **Computation Time**: Average milliseconds per pathfinding call
2. **Nodes Visited**: Exploration efficiency
3. **Ticks to Catch**: Gameplay effectiveness
4. **Success Rate**: Percentage of trials where Pac-Man was caught

Results are displayed in a sortable table for easy comparison.

## 🎯 Research Questions

This project addresses:

1. **Performance**: Which algorithm computes paths fastest?
2. **Effectiveness**: Which catches Pac-Man most efficiently?
3. **Scalability**: How do algorithms perform as complexity increases?
4. **Trade-offs**: Optimal paths vs. computation time

## 🔧 Development

### Project Structure

```
pacman-pathfinding/
├── frontend/
│   └── index.html       # Single-page application
├── backend/
│   ├── server.js        # Express server
│   ├── algorithms.js    # Pathfinding implementations
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
PORT=3000                 # Server port
NODE_ENV=development      # Environment mode
```

## 🧪 Testing

Manual testing checklist:

- [ ] All four algorithms find paths successfully
- [ ] Visualization shows visited/frontier/path correctly
- [ ] Ghosts move toward Pac-Man
- [ ] Benchmark completes without errors
- [ ] API returns proper JSON responses
- [ ] Ghost collision detection works
- [ ] Reset functionality works

## 📝 Future Enhancements

- [ ] Moving Pac-Man with user controls
- [ ] Multiple simultaneous simulations
- [ ] CSV/JSON export of benchmark data
- [ ] Chart visualizations of results
- [ ] WebSocket for real-time updates
- [ ] Additional algorithms (JPS, Theta\*)
- [ ] Configurable heuristics
- [ ] Replay functionality

## 🐛 Known Issues

- Ghosts can overlap in same cell
- No pathfinding optimization for repeated calls
- Benchmark runs synchronously (blocks server)
- No database for historical results

## 📄 License

MIT License - See project requirements

## 👤 Author

Rune Røddik Hansen (ruha0001)

## 🙏 Acknowledgments

- Original Pac-Man game by Namco
- Pathfinding algorithm research and documentation
