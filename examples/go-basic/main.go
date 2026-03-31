package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	baseURL := os.Getenv("AGENT_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3000/api/v1"
	}

	payload, _ := json.Marshal(map[string]any{
		"prompt":   "What is the top story on Hacker News right now? Give me the title and score.",
		"maxSteps": 5,
	})

	resp, err := http.Post(baseURL+"/run", "application/json", bytes.NewReader(payload))
	if err != nil {
		fmt.Fprintf(os.Stderr, "request failed: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "server error %d: %s\n", resp.StatusCode, body)
		os.Exit(1)
	}

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)

	text, _ := result["text"].(string)
	fmt.Println(text)

	steps, _ := result["steps"].([]any)
	fmt.Printf("\nSteps: %d\n", len(steps))

	if usage, ok := result["usage"].(map[string]any); ok {
		fmt.Printf("Tokens: %.0f\n", usage["totalTokens"])
	}
}
