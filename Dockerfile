FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ENV HOST=127.0.0.1 \
    PORT=3003 \
    SQLITE_PATH=/app/data/punk-records.sqlite \
    CHROMA_HOST=chroma \
    CHROMA_PORT=8000 \
    LLM_PROVIDER=mock

EXPOSE 3003

CMD ["bun", "run", "start"]
