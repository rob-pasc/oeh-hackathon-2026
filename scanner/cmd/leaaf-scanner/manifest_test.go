package main

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

// The scanner must ask for administrator rights on start (feature 001 FR-001). The Windows
// build links the committed .syso, so check both the source config and the generated file;
// a stale .syso after editing winres.json shows up here.
func TestManifestRequiresAdministrator(t *testing.T) {
	raw, err := os.ReadFile("winres/winres.json")
	if err != nil {
		t.Fatal(err)
	}
	var cfg struct {
		Manifest map[string]map[string]struct {
			ExecutionLevel string `json:"execution-level"`
		} `json:"RT_MANIFEST"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		t.Fatal(err)
	}
	if got := cfg.Manifest["#1"]["0409"].ExecutionLevel; got != "administrator" {
		t.Errorf("winres.json execution-level = %q, want administrator", got)
	}

	syso, err := os.ReadFile("rsrc_windows_amd64.syso")
	if err != nil {
		t.Fatalf("%v (run go generate ./cmd/leaaf-scanner)", err)
	}
	if !bytes.Contains(syso, []byte(`level="requireAdministrator"`)) {
		t.Error(`rsrc_windows_amd64.syso does not request requireAdministrator; rerun go generate ./cmd/leaaf-scanner`)
	}
}
