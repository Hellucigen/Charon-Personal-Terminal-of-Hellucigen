// Package modules — network toolbox: connectivity checks, encoders and a
// mini-Postman. Everything is stateless; nothing is persisted.
package modules

import (
	"bytes"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"time"
)

type NetService struct{}

func NewNetService() *NetService { return &NetService{} }

// LocalInfo returns host interfaces and outbound IP.
func (s *NetService) LocalInfo() (map[string]interface{}, error) {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
	}
	outIP := ""
	if err == nil {
		outIP = conn.LocalAddr().(*net.UDPAddr).IP.String()
	}
	ifaces := []map[string]interface{}{}
	list, _ := net.Interfaces()
	for _, ifc := range list {
		addrs := []string{}
		a, _ := ifc.Addrs()
		for _, addr := range a {
			addrs = append(addrs, addr.String())
		}
		ifaces = append(ifaces, map[string]interface{}{"name": ifc.Name, "addrs": addrs})
	}
	return map[string]interface{}{"outbound_ip": outIP, "hostname": runtimeHostName(), "interfaces": ifaces}, nil
}

func runtimeHostName() string {
	h, err := os.Hostname()
	if err != nil {
		return ""
	}
	return h
}

// Lookup resolves a hostname to IPs.
func (s *NetService) Lookup(host string) ([]string, error) {
	if host == "" {
		return nil, errRequired("host")
	}
	addrs, err := net.LookupHost(host)
	if err != nil {
		return nil, err
	}
	return addrs, nil
}

// Ping shells out to the system ping (4 packets) and returns raw output.
func (s *NetService) Ping(host string) (string, error) {
	if host == "" {
		return "", errRequired("host")
	}
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "4", host)
	} else {
		cmd = exec.Command("ping", "-c", "4", host)
	}
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// HTTPRequest is the mini-Postman: method/url/headers/body → response.
func (s *NetService) HTTPRequest(method, rawURL string, headers map[string]string, body string) (map[string]interface{}, error) {
	if rawURL == "" {
		return nil, errRequired("url")
	}
	if method == "" {
		method = "GET"
	}
	var rd io.Reader
	if body != "" && method != "GET" && method != "HEAD" {
		rd = bytes.NewReader([]byte(body))
	}
	req, err := http.NewRequest(method, rawURL, rd)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	start := time.Now()
	c := http.Client{Timeout: 20 * time.Second}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	ms := time.Since(start).Milliseconds()

	hdrs := map[string][]string{}
	for k, v := range resp.Header {
		hdrs[k] = v
	}
	text := string(raw)
	pretty := text
	if looksJSON := json.Valid(raw); looksJSON {
		var buf bytes.Buffer
		if json.Indent(&buf, raw, "", "  ") == nil {
			pretty = buf.String()
		}
	}
	return map[string]interface{}{
		"status": resp.StatusCode, "ms": ms, "headers": hdrs, "body": pretty,
	}, nil
}

// Encode converts text with the chosen codec (base64|base64d|urlencode|urldecode|md5|sha1|sha256|json).
func (s *NetService) Encode(kind, text string) (string, error) {
	switch kind {
	case "base64":
		return base64.StdEncoding.EncodeToString([]byte(text)), nil
	case "base64d":
		b, err := base64.StdEncoding.DecodeString(text)
		return string(b), err
	case "urlencode":
		return url.QueryEscape(text), nil
	case "urldecode":
		return url.QueryUnescape(text)
	case "md5":
		h := md5.Sum([]byte(text))
		return hex.EncodeToString(h[:]), nil
	case "sha1":
		h := sha1.Sum([]byte(text))
		return hex.EncodeToString(h[:]), nil
	case "sha256":
		h := sha256.Sum256([]byte(text))
		return hex.EncodeToString(h[:]), nil
	case "json":
		var v interface{}
		if err := json.Unmarshal([]byte(text), &v); err != nil {
			return "", fmt.Errorf("invalid JSON: %w", err)
		}
		b, err := json.MarshalIndent(v, "", "  ")
		return string(b), err
	default:
		return "", fmt.Errorf("unknown codec: %s", kind)
	}
}

// RegexTest matches a pattern against text and returns all matches.
func (s *NetService) RegexTest(pattern, text string, flags string) (map[string]interface{}, error) {
	if pattern == "" {
		return nil, errRequired("pattern")
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	matches := re.FindAllString(text, 100)
	groups := [][]string{}
	for _, m := range re.FindAllStringSubmatch(text, 20) {
		groups = append(groups, m)
	}
	return map[string]interface{}{"valid": true, "count": len(matches), "matches": matches, "groups": groups}, nil
}
