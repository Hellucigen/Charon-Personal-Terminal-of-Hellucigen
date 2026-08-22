// Package modules — finance: transactions with manual + Alipay/WeChat CSV
// import, monthly & category summaries, and subscription tracking.
package modules

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Transaction struct {
	ID         string  `json:"id"`
	Amount     float64 `json:"amount"` // +income / -expense
	Currency   string  `json:"currency"`
	Category   string  `json:"category"`
	Account    string  `json:"account"`
	Note       string  `json:"note"`
	OccurredAt int64   `json:"occurred_at"`
	Source     string  `json:"source"` // manual|alipay|wechat|travel
}

type Subscription struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Cost      float64 `json:"cost"`
	Cycle     string  `json:"cycle"` // weekly|monthly|yearly
	NextAt    int64   `json:"next_at"`
	Note      string  `json:"note"`
	CreatedAt int64   `json:"created_at"`
}

type FinanceService struct{}

func NewFinanceService() *FinanceService { return &FinanceService{} }
func (s *FinanceService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *FinanceService) SaveTransaction(t Transaction) (*Transaction, error) {
	if t.Currency == "" {
		t.Currency = "CNY"
	}
	if t.Category == "" {
		t.Category = "misc"
	}
	if t.Account == "" {
		t.Account = "default"
	}
	if t.OccurredAt == 0 {
		t.OccurredAt = time.Now().Unix()
	}
	if t.ID == "" {
		t.ID = newID("tx_")
		_, err := s.store().DB.Exec(
			`INSERT INTO transactions(id,amount,currency,category,account,note,occurred_at,source)
			 VALUES(?,?,?,?,?,?,?,?)`,
			t.ID, t.Amount, t.Currency, t.Category, t.Account, t.Note, t.OccurredAt, t.Source)
		if err != nil {
			return nil, err
		}
		core.GlobalBus.Publish("finance.tx.created", map[string]interface{}{"id": t.ID})
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE transactions SET amount=?,currency=?,category=?,account=?,note=?,occurred_at=? WHERE id=?`,
			t.Amount, t.Currency, t.Category, t.Account, t.Note, t.OccurredAt, t.ID)
		if err != nil {
			return nil, err
		}
	}
	return &t, nil
}

func (s *FinanceService) DeleteTransaction(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM transactions WHERE id=?`, id)
	return err
}

// Transactions returns rows filtered by month ("YYYY-MM") and/or category.
func (s *FinanceService) Transactions(month, category string, limit int) ([]Transaction, error) {
	if limit <= 0 {
		limit = 300
	}
	q := `SELECT id,amount,currency,category,account,note,occurred_at,source FROM transactions WHERE 1=1`
	args := []interface{}{}
	if month != "" {
		start, err := time.Parse("2006-01", month)
		if err == nil {
			end := start.AddDate(0, 1, 0).Unix()
			q += ` AND occurred_at BETWEEN ? AND ?`
			args = append(args, start.Unix(), end)
		}
	}
	if category != "" {
		q += ` AND category=?`
		args = append(args, category)
	}
	q += ` ORDER BY occurred_at DESC LIMIT ?`
	args = append(args, limit)
	rows, err := s.store().DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Transaction{}
	for rows.Next() {
		var t Transaction
		if err := rows.Scan(&t.ID, &t.Amount, &t.Currency, &t.Category, &t.Account, &t.Note, &t.OccurredAt, &t.Source); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

// Summary aggregates income/expense/net by month and by category.
func (s *FinanceService) Summary(months int) (map[string]interface{}, error) {
	if months <= 0 {
		months = 6
	}
	since := time.Now().AddDate(0, -months, 0).Unix()

	byMonth := []map[string]interface{}{}
	rows, err := s.store().DB.Query(`
		SELECT strftime('%Y-%m', occurred_at, 'unixepoch') AS m,
			SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) AS income,
			SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END) AS expense
		FROM transactions WHERE occurred_at>=? GROUP BY m ORDER BY m`, since)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var m string
		var income, expense float64
		if err := rows.Scan(&m, &income, &expense); err != nil {
			rows.Close()
			return nil, err
		}
		byMonth = append(byMonth, map[string]interface{}{"month": m, "income": income, "expense": expense, "net": income - expense})
	}
	rows.Close()

	byCategory := []map[string]interface{}{}
	rows, err = s.store().DB.Query(`
		SELECT category, SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END) AS expense
		FROM transactions WHERE occurred_at>=? AND amount<0 GROUP BY category ORDER BY expense DESC`, since)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var c string
		var e float64
		if err := rows.Scan(&c, &e); err != nil {
			rows.Close()
			return nil, err
		}
		byCategory = append(byCategory, map[string]interface{}{"category": c, "expense": e})
	}
	rows.Close()

	return map[string]interface{}{"by_month": byMonth, "by_category": byCategory}, nil
}

// ImportCSV parses Alipay / WeChat bill exports and generic
// date,amount,category,note CSVs. Returns the number imported.
func (s *FinanceService) ImportCSV(path, kind string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	// Alipay/WeChat exports are GBK-ish; try UTF-8 first, fall back to GBK.
	data, _ := io.ReadAll(f)
	text := string(data)
	if strings.Contains(text, "\ufffd") {
		if dec, err := decodeGBK(data); err == nil {
			text = dec
		}
	}
	r := csv.NewReader(strings.NewReader(text))
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	n := 0
	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil || len(row) < 2 {
			continue
		}
		var t Transaction
		t.Source = kind
		switch kind {
		case "alipay":
			t = parseAlipayRow(row)
		case "wechat":
			t = parseWechatRow(row)
		default:
			t = parseGenericRow(row)
		}
		if t.Amount == 0 {
			continue
		}
		if _, err := s.SaveTransaction(t); err != nil {
			continue
		}
		n++
	}
	core.GlobalBus.Publish("finance.imported", map[string]interface{}{"count": n, "kind": kind})
	return n, nil
}

func parseAlipayRow(row []string) Transaction {
	// Alipay: 交易时间,交易分类,对方,商品说明,收/支,金额,...
	get := func(i int) string {
		if i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	amt := parseAmountF(get(5))
	t := Transaction{Category: mapAlipayCategory(get(1)), Note: get(3), Account: "alipay"}
	switch get(4) {
	case "收入":
		t.Amount = amt
	case "支出":
		t.Amount = -amt
	default:
		t.Amount = 0
	}
	t.OccurredAt = parseTimeF(get(0))
	return t
}

func parseWechatRow(row []string) Transaction {
	get := func(i int) string {
		if i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	// WeChat: 交易时间,交易类型,对方,商品,收/支,金额(元),...
	amt := parseAmountF(strings.TrimPrefix(get(5), "¥"))
	t := Transaction{Category: "wechat", Note: get(3), Account: "wechat"}
	switch get(4) {
	case "收入":
		t.Amount = amt
	case "支出":
		t.Amount = -amt
	default:
		t.Amount = 0
	}
	t.OccurredAt = parseTimeF(get(0))
	return t
}

func parseGenericRow(row []string) Transaction {
	t := Transaction{Source: "manual"}
	t.OccurredAt = parseTimeF(row[0])
	t.Amount = parseAmountF(row[1])
	if len(row) > 2 && row[2] != "" {
		t.Category = row[2]
	}
	if len(row) > 3 {
		t.Note = row[3]
	}
	return t
}

func mapAlipayCategory(in string) string {
	in = strings.ToLower(in)
	switch {
	case strings.Contains(in, "餐饮"), strings.Contains(in, "美食"):
		return "food"
	case strings.Contains(in, "交通"):
		return "transport"
	case strings.Contains(in, "购物"):
		return "shopping"
	case strings.Contains(in, "娱乐"):
		return "fun"
	default:
		return "misc"
	}
}

func parseAmountF(s string) float64 {
	s = strings.TrimPrefix(strings.TrimSpace(s), "¥")
	var v float64
	fmt.Sscanf(s, "%f", &v)
	return v
}

func parseTimeF(s string) int64 {
	for _, layout := range []string{"2006-01-02 15:04:05", "2006/01/02 15:04", "2006-01-02", "2006/01/02"} {
		if t, err := time.ParseInLocation(layout, strings.TrimSpace(s), time.Local); err == nil {
			return t.Unix()
		}
	}
	return time.Now().Unix()
}

// ── subscriptions ──────────────────────────────────────────────────────

func (s *FinanceService) SaveSubscription(sub Subscription) (*Subscription, error) {
	if sub.Name == "" {
		return nil, errRequired("name")
	}
	if sub.Cycle == "" {
		sub.Cycle = "monthly"
	}
	if sub.ID == "" {
		sub.ID = newID("sb_")
		sub.CreatedAt = time.Now().Unix()
		_, err := s.store().DB.Exec(
			`INSERT INTO subscriptions(id,name,cost,cycle,next_at,note,created_at) VALUES(?,?,?,?,?,?,?)`,
			sub.ID, sub.Name, sub.Cost, sub.Cycle, nullableI64(sub.NextAt), sub.Note, sub.CreatedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE subscriptions SET name=?,cost=?,cycle=?,next_at=?,note=? WHERE id=?`,
			sub.Name, sub.Cost, sub.Cycle, nullableI64(sub.NextAt), sub.Note, sub.ID)
		if err != nil {
			return nil, err
		}
	}
	return &sub, nil
}

func (s *FinanceService) DeleteSubscription(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM subscriptions WHERE id=?`, id)
	return err
}

func (s *FinanceService) Subscriptions() ([]Subscription, error) {
	rows, err := s.store().DB.Query(`SELECT id,name,cost,cycle,COALESCE(next_at,0),note,created_at FROM subscriptions ORDER BY next_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Subscription{}
	for rows.Next() {
		var sub Subscription
		if err := rows.Scan(&sub.ID, &sub.Name, &sub.Cost, &sub.Cycle, &sub.NextAt, &sub.Note, &sub.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, sub)
	}
	return out, nil
}
