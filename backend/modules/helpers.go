package modules

import (
	"fmt"

	"golang.org/x/text/encoding/simplifiedchinese"
)

func errRequired(field string) error { return fmt.Errorf("%s is required", field) }

// decodeGBK converts Alipay/WeChat CSV exports (GBK) to UTF-8.
func decodeGBK(b []byte) (string, error) {
	out, err := simplifiedchinese.GBK.NewDecoder().Bytes(b)
	return string(out), err
}
