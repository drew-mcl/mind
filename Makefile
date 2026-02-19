build:
	go build -o mind ./cmd/mind

install: build
	cp mind /usr/local/bin/mind
