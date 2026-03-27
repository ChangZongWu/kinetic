import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRef, useState } from 'react';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const QUICK_PROMPTS = [
  "What should I train today?",
  "How can I improve my bench press?",
  "Tips for faster recovery?",
  "How many rest days do I need?",
];

export default function AIAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const send = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);
    setLoading(true);
    scrollToBottom();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              accumulated = 'Sorry, something went wrong. Please try again.';
            } else if (parsed.text) {
              accumulated += parsed.text;
            }
          } catch {
            // ignore malformed lines
          }
        }

        // Update the streaming message in place
        const current = accumulated;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: current, streaming: true }
              : m
          )
        );
        scrollToBottom();
      }

      // Mark streaming done
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, streaming: false } : m
        )
      );
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Could not reach the AI advisor. Check your connection.', streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
            {item.content}
            {item.streaming && item.content === '' ? (
              <Text style={styles.cursor}>▋</Text>
            ) : item.streaming ? (
              <Text style={styles.cursor}>▋</Text>
            ) : null}
          </Text>
        </View>
      </View>
    );
  };

  const isEmpty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI ADVISOR</Text>
        <Text style={styles.headerSub}>Powered by Claude</Text>
      </View>

      {/* Messages / Empty State */}
      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyTitle}>Your AI fitness coach</Text>
          <Text style={styles.emptyBody}>
            Ask me anything about your training, recovery, nutrition timing, or form.
          </Text>
          <View style={styles.quickRow}>
            {QUICK_PROMPTS.map(q => (
              <TouchableOpacity
                key={q}
                style={styles.quickChip}
                onPress={() => send(q)}
                disabled={loading}
              >
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
        />
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask your AI advisor…"
          placeholderTextColor={colors.onSurfaceVariant}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => send()}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primaryContainer,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 40,
    color: colors.primaryContainer,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  quickRow: {
    marginTop: 8,
    gap: 8,
    width: '100%',
  },
  quickChip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  quickChipText: {
    color: colors.onSurface,
    fontSize: 13,
  },

  // Messages
  messageList: {
    padding: 16,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAI: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.onPrimaryContainer,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.primaryContainer,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: colors.surfaceContainerHigh,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: colors.onPrimaryContainer,
    fontWeight: '500',
  },
  bubbleTextAI: {
    color: colors.onSurface,
  },
  cursor: {
    color: colors.primaryContainer,
    opacity: 0.8,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.background,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
});
