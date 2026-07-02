package core

import (
	"sync"
	"time"
)

// Event is the unit traveling across the bus. Topic identifies the channel
// (e.g. "notes.created", "fascinator.activated"); Payload is opaque JSON-like.
type Event struct {
	Topic     string                 `json:"topic"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
}

type Subscriber func(e Event)

// EventBus is a tiny topic-based pub/sub used to wire modules together
// without hard imports. Listeners are invoked synchronously in a goroutine
// pool. Lost messages are accepted; this is not a durable queue.
type EventBus struct {
	mu   sync.RWMutex
	subs map[string][]Subscriber
}

func NewEventBus() *EventBus {
	return &EventBus{subs: make(map[string][]Subscriber)}
}

func (b *EventBus) Subscribe(topic string, fn Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subs[topic] = append(b.subs[topic], fn)
}

func (b *EventBus) Publish(topic string, payload map[string]interface{}) {
	b.mu.RLock()
	listeners := append([]Subscriber(nil), b.subs[topic]...)
	wildcard := append([]Subscriber(nil), b.subs["*"]...)
	b.mu.RUnlock()

	ev := Event{Topic: topic, Payload: payload, Timestamp: time.Now()}
	for _, l := range listeners {
		go l(ev)
	}
	for _, l := range wildcard {
		go l(ev)
	}
}
