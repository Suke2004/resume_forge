# Dedicated Sandboxed TeX Live Compilation Worker
FROM debian:bookworm-slim

# Install minimal pinned TeX Live packages and poppler-utils (pdfinfo, pdftotext)
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    poppler-utils \
    nodejs \
    npm \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Create unprivileged non-root user for isolated compilation
RUN groupadd -r texworker && useradd -r -g texworker -m -d /home/texworker texworker

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY worker/worker-server.ts ./

USER texworker
EXPOSE 8080

CMD ["npx", "tsx", "worker-server.ts"]
