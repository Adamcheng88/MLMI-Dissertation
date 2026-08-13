# Supporting Domain Expert Sensemaking of Agent Generated Decision Trees

DEFT HCI user study interface — an Express + SQLite backend with a React frontend for exploring, configuring, and evaluating agent-generated decision trees.

## Structure

- `deft/` — React frontend (Vite + TypeScript)
- `server/` — Express API routes, database, and prompts
- `server.js` — Application entry point
- `public/` — Built frontend assets (production)
- `docs/` — Study documentation and interview materials

## Setup

1. Install dependencies:

```bash
npm install
cd deft && npm install
```

2. Create a `.env` file in the project root:

```
OPEN_API_KEY=your_openai_api_key
```

3. Start the server:

```bash
npm start
```

4. For frontend development:

```bash
cd deft && npm run dev
```

## Build

```bash
npm run build
```
