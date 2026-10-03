# CiteDocs

Team docs Q&A. You ask a question, the app answers from your team's documents, and every answer cites the chunk it came from. Search only returns chunks your role is allowed to see.

Stack: Next.js, Postgres, pgvector, Prisma. Models run locally with Ollama.

## Run locally

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and [Ollama](https://ollama.com).
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Start the database: `docker compose up -d`
5. Apply the schema: `npx prisma migrate dev`
6. Create the demo users: `npm run db:seed`
7. Pull the models: `ollama pull nomic-embed-text` and `ollama pull llama3.2`
8. Start the app: `npm run dev`

Open http://localhost:3000

Both demo accounts use the password `citedocs`.

- `admin@citedocs.test` is an admin on the Demo team.
- `member@citedocs.test` is a member on the Demo team.

The init migration already runs `CREATE EXTENSION IF NOT EXISTS vector`. There is no vector index on purpose.

## Done when

- Two users on one team can sign in. One is an admin, one is a member.
- An admin can upload a document and mark it `team` or `admins`.
- A member's question never retrieves an `admins` chunk, even if that chunk is the closest match.
- The answer shows the source: document title, chunk, and a short quote.
- A script runs 20–30 saved questions and reports how often the right chunk was in the top results.

## What we will build

1. **App setup.** Next.js (App Router, TypeScript), Prisma, Postgres with pgvector.
2. **Auth.** Email and password. A seed script creates the demo team and both users so the permission demo is easy to run.
3. **Teams and roles.** A user can belong to a team as `admin` or `member`.
4. **Documents.** Upload a text or PDF file. Each document belongs to one team and has a visibility: `team` (everyone on the team) or `admins` (admins only).
5. **Chunks and embeddings.** Split the document into chunks, store each chunk with its team and visibility, and save an embedding in pgvector.
6. **Ask.** One question box. Retrieve similar chunks the current user is allowed to see, then generate an answer that cites those chunks.
7. **Retrieval test.** A file of 20–30 questions. Each question names the chunk that should be found. A script scores whether that chunk showed up in the top results. This scores retrieval, not the wording of the answer.
8. **Write-up.** Retrieval scores are in [How we tested](#how-we-tested).

## Permissions

Access is decided on the document, then copied onto every chunk.

- `team`: any member of that team can retrieve it.
- `admins`: only admins of that team can retrieve it.

The vector search itself filters by team and role. We do not fetch nearby chunks and hide them afterward. A member and an admin can ask the same question and get different sources.

We are not building per-user access on single paragraphs. If a document is `admins`, every chunk of it is `admins`.

## Decisions

- The embedding column is `vector(768)` via `Unsupported("vector(768)")`. Prisma does not query that column. Similarity search uses `prisma.$queryRaw`. Every other query stays normal Prisma.
- No vector index in the demo. pgvector can use an HNSW index before the permission filter, so a member can get fewer than 5 rows, or none, when the nearest chunks are `admins`. An exact scan avoids that. This is the hard-bug write-up: show the failure, then the fix.
- Every ask request reads role and team from the session and membership on the server. The client does not send them.
- One automated test seeds an `admins` chunk whose text is the question, asks as a member, and asserts that chunk never comes back.
- Visibility is copied onto chunks at upload. Editing visibility is out of scope. If we add it later, the document and its chunks must update in the same transaction.

## Data we will store

- **User** and **Session** for sign-in.
- **Team** and **Membership** (user, team, role).
- **Document** (team, title, visibility, file text).
- **Chunk** (document, text, visibility, team, embedding).
- **Question** (user, question text, answer, cited chunk ids) so a demo leaves a record.
- **Eval questions** live in a file in the repo, not in the database.

## Out of scope

- Booking app and background jobs. Those are later projects.
- SSO, billing, and more than the two roles above.
- Editing document text inside the app. Upload only.
- A full chat product. One question and its answer is enough.
- Scoring whether the model's sentences are "good." The test set scores the retrieved chunk.

## Defaults

- Models run on your computer with [Ollama](https://ollama.com). No API key and no paid account.
- Embeddings use `nomic-embed-text` (768 dimensions). Answers use `llama3.2`, a small local chat model.
- Chunks are 300 characters, with a small overlap. That size scored best for vector search.
- Top results default to 5 chunks.
- Demo data is seeded, including a couple of `admins` documents so the filter is obvious.

The retrieval test only checks which chunk was found. It does not need the chat model. Answer quality will be lower than a paid model, and that is fine for this project.

## How we tested

41 questions, plus 4 checks that a member search must not return an admins chunk. 24 filler documents sit on the same team so the right chunk has more to compete with. The app searches with vectors only. Keyword search and hybrid search (reciprocal rank fusion of the two top-5 lists) are comparisons, not what a user gets.

| Chunk size | Method | Hit@1 | Hit@5 | MRR |
| --- | --- | --- | --- | --- |
| 300 | Vector | 20/41 (48.8%) | 36/41 (87.8%) | 0.653 |
| 300 | Keyword | 16/41 (39.0%) | 27/41 (65.9%) | 0.497 |
| 300 | Hybrid | 21/41 (51.2%) | 34/41 (82.9%) | 0.642 |
| 500 | Vector | 16/41 (39.0%) | 35/41 (85.4%) | 0.585 |
| 500 | Keyword | 18/41 (43.9%) | 27/41 (65.9%) | 0.515 |
| 800 | Vector | 7/41 (17.1%) | 33/41 (80.5%) | 0.435 |
| 800 | Keyword | 21/41 (51.2%) | 32/41 (78.0%) | 0.603 |

Smaller chunks helped vector search. Bigger chunks helped keyword search. Hybrid picked up one more first-place hit than vector search at 300 characters, and did worse on Hit@5 and MRR. This is 41 questions, so two or three hits move the percentages a lot. Read the gaps as a direction.
