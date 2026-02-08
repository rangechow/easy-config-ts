import { describe, it, expect } from 'vitest';
import { validateProtoSyntax, formatValidationErrors } from '../../src/main/convert/proto-validator';

const VALID_PROTO = `syntax = "proto3";

package dataconfig;

message MonsterConfig {
  uint32 id = 1;
  optional string name = 2;
  optional int32 level = 3;
}
`;

describe('validateProtoSyntax', () => {
  it('returns no errors for valid proto', () => {
    const errors = validateProtoSyntax(VALID_PROTO);
    expect(errors).toEqual([]);
  });

  it('detects missing syntax declaration', () => {
    const content = `package dataconfig;
message Foo {
  uint32 id = 1;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes('Missing syntax declaration'))).toBe(true);
  });

  it('detects invalid syntax declaration', () => {
    const content = `syntax = "proto2";
message Foo {
  uint32 id = 1;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes('Invalid syntax declaration'))).toBe(true);
  });

  it('detects unmatched braces', () => {
    const content = `syntax = "proto3";
message Foo {
  uint32 id = 1;
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes('Unmatched braces'))).toBe(true);
  });

  it('detects unmatched closing brace', () => {
    const content = `syntax = "proto3";
message Foo {
  uint32 id = 1;
}
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes("Unmatched closing brace '}'"))).toBe(true);
  });

  it('detects duplicate field tags', () => {
    const content = `syntax = "proto3";
message Foo {
  uint32 id = 1;
  string name = 1;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes('Duplicate field tag 1'))).toBe(true);
  });

  it('detects reserved range field tags (19000-19999)', () => {
    const content = `syntax = "proto3";
message Foo {
  uint32 id = 19000;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes('reserved range'))).toBe(true);
  });

  it('detects non-PascalCase message names', () => {
    const content = `syntax = "proto3";
message foo_bar {
  uint32 id = 1;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes('PascalCase'))).toBe(true);
  });

  it('detects duplicate message names', () => {
    const content = `syntax = "proto3";
message Foo {
  uint32 id = 1;
}
message Foo {
  string name = 1;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors.some((e) => e.message.includes('Duplicate message name'))).toBe(true);
  });

  it('allows valid field names', () => {
    const content = `syntax = "proto3";
message Foo {
  uint32 my_field_name = 1;
  string anotherField = 2;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors).toEqual([]);
  });

  it('validates nested messages', () => {
    const content = `syntax = "proto3";

message Outer {
  message Inner {
    uint32 id = 1;
  }
  Inner inner = 1;
}
`;
    const errors = validateProtoSyntax(content);
    expect(errors).toEqual([]);
  });
});

describe('formatValidationErrors', () => {
  it('returns empty string for no errors', () => {
    expect(formatValidationErrors([])).toBe('');
  });

  it('formats errors with line numbers', () => {
    const errors = [
      { line: 5, column: 0, message: 'Test error 1' },
      { line: 10, column: 3, message: 'Test error 2' },
    ];
    const result = formatValidationErrors(errors);
    expect(result).toContain('Found 2 validation error(s)');
    expect(result).toContain('Line 5, Column 0: Test error 1');
    expect(result).toContain('Line 10, Column 3: Test error 2');
  });

  it('formats errors without line numbers', () => {
    const errors = [{ line: 0, column: 0, message: 'Global error' }];
    const result = formatValidationErrors(errors);
    expect(result).toContain('1. Global error');
    expect(result).not.toContain('Line 0');
  });
});
