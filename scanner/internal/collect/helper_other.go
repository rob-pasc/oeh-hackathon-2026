//go:build !linux

package collect

import (
	"fmt"
	"io"
)

// RunHelper exists only on Linux; elsewhere the flag is refused.
func RunHelper(w io.Writer) int {
	fmt.Fprintln(w, "the privileged helper is only available on Linux")
	return 2
}
