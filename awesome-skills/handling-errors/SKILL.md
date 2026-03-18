---
name: handling-errors
description: Master error handling patterns across languages including exceptions, Result types, error propagation, and graceful degradation to build resilient applications. Use when implementing error handling, designing APIs, or improving application reliability.
---

# Error Handling Patterns

**Description:** Build resilient applications with robust error handling strategies that gracefully handle failures and provide excellent debugging experiences.

## When to Use This Skill
- Implementing error handling in new features
- Designing error-resilient APIs
- Debugging production issues
- Improving application reliability
- Creating better error messages for users and developers
- Implementing retry and circuit breaker patterns
- Handling async/concurrent errors
- Building fault-tolerant distributed systems

## Core Concepts

### 1. Error Handling Philosophies
**Exceptions vs Result Types:**
- **Exceptions:** Traditional try-catch, disrupts control flow (Java, Python, JS)
- **Result Types:** Explicit success/failure, functional approach (Rust, Elm, Haskell)
- **Error Codes:** C-style, requires discipline (Go, C)
- **Option/Maybe Types:** For nullable values

**When to Use Each:**
- **Exceptions:** Unexpected errors, exceptional conditions
- **Result Types:** Expected errors, validation failures
- **Panics/Crashes:** Unrecoverable errors, programming bugs

### 2. Error Categories
**Recoverable Errors:**
- Network timeouts
- Missing files
- Invalid user input
- API rate limits

**Unrecoverable Errors:**
- Out of memory
- Stack overflow
- Programming bugs (null pointer, etc.)

## Language-Specific Patterns

### Python Error Handling
**Custom Exception Hierarchy:**
```python
class ApplicationError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class ValidationError(ApplicationError):
    """Raised when validation fails."""
    pass

class NotFoundError(ApplicationError):
    """Raised when resource not found."""
    pass
```

**Context Managers for Cleanup:**
```python
from contextlib import contextmanager

@contextmanager
def database_transaction(session):
    """Ensure transaction is committed or rolled back."""
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()
```

**Retry with Exponential Backoff:**
```python
def retry(max_attempts=3, backoff_factor=2.0, exceptions=(Exception,)):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions:
                    if attempt < max_attempts - 1:
                        time.sleep(backoff_factor ** attempt)
                        continue
                    raise
            return func(*args, **kwargs)
        return wrapper
    return decorator
```

### TypeScript/JavaScript Error Handling
**Custom Error Classes:**
```typescript
class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**Result Type Pattern:**
```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function parseJSON<T>(json: string): Result<T, SyntaxError> {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (error) {
    return { ok: false, error: error as SyntaxError };
  }
}
```

### Rust Error Handling
**Result and Option Types:**
```rust
fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;  // ? operator propagates errors
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}
```

### Go Error Handling
**Explicit Error Returns:**
```go
func getUser(id string) (*User, error) {
    user, err := db.QueryUser(id)
    if err != nil {
        return nil, fmt.Errorf("failed to query user: %w", err)
    }
    return user, nil
}
```

## Universal Patterns

### Pattern 1: Circuit Breaker
Prevent cascading failures in distributed systems.
*(See Python implementation in original text describing standard Circuit Breaker state machine: Closed -> Open -> Half-Open)*

### Pattern 2: Error Aggregation
Collect multiple errors instead of failing on first error (useful for validation).

```typescript
class ErrorCollector {
  private errors: Error[] = [];
  add(error: Error) { this.errors.push(error); }
  throw() { if (this.errors.length > 0) throw new AggregateError(this.errors); }
}
```

### Pattern 3: Graceful Degradation
Provide fallback functionality when errors occur.
```python
def with_fallback(primary, fallback):
    try:
        return primary()
    except Exception:
        return fallback()
```

## Best Practices
1.  **Fail Fast:** Validate input early, fail quickly.
2.  **Preserve Context:** Include stack traces, metadata, and timestamps.
3.  **Meaningful Messages:** Explain what happened *and* how to fix it.
4.  **Log Appropriately:** Error = log; Expected failure = don't spam logs.
5.  **Clean Up Resources:** Always use `try-finally`, context managers, or `defer`.
6.  **Don't Swallow Errors:** Log or re-throw; never silently ignore.

## Common Pitfalls
- `except Exception:` (Catching too broadly)
- Empty catch blocks
- Logging AND re-throwing (duplicate logs)
- Returning error codes instead of using proper types or exceptions
- Ignoring async errors (unhandled promise rejections)
