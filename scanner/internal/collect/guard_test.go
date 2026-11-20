package collect

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

func TestGuardedTurnsPanicIntoError(t *testing.T) {
	// The panic seen on Windows: the wmi package calling Uint() on an int32 array element.
	err := guarded(func() error {
		reflect.ValueOf(int32(10)).Uint()
		return nil
	})
	if err == nil || !strings.Contains(err.Error(), "reflect") {
		t.Fatalf("want an error describing the panic, got %v", err)
	}
}

func TestGuardedPassesThroughResult(t *testing.T) {
	if err := guarded(func() error { return nil }); err != nil {
		t.Fatalf("want nil, got %v", err)
	}
	want := errors.New("access denied")
	if err := guarded(func() error { return want }); !errors.Is(err, want) {
		t.Fatalf("want %v, got %v", want, err)
	}
}
