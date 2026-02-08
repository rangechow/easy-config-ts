import { execFileSync } from 'child_process';

// ---- Types ----

export interface ProtoValidationError {
  line: number;
  column: number;
  message: string;
}

// ---- Public API ----

/** Validate proto file syntax (built-in checks) */
export function validateProtoSyntax(protoContent: string): ProtoValidationError[] {
  const errors: ProtoValidationError[] = [];
  errors.push(...validateBasicSyntax(protoContent));
  errors.push(...validateFieldTags(protoContent));
  errors.push(...validateMessageNames(protoContent));
  errors.push(...validateFieldNames(protoContent));
  errors.push(...validateDataTypes(protoContent));
  return errors;
}

/** Validate proto file using protoc compiler (if available) */
export function validateProtoFile(protoFilePath: string): void {
  try {
    execFileSync('protoc', ['--proto_path=.', '--descriptor_set_out=/dev/null', protoFilePath]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`protoc validation failed: ${message}`);
  }
}

/** Format validation errors into a human-readable string */
export function formatValidationErrors(errors: ProtoValidationError[]): string {
  if (errors.length === 0) return '';

  let result = `Found ${errors.length} validation error(s):\n\n`;
  for (let i = 0; i < errors.length; i++) {
    const e = errors[i];
    if (e.line > 0) {
      result += `${i + 1}. Line ${e.line}, Column ${e.column}: ${e.message}\n`;
    } else {
      result += `${i + 1}. ${e.message}\n`;
    }
  }
  return result;
}

// ---- Internal validators ----

function validateBasicSyntax(content: string): ProtoValidationError[] {
  const errors: ProtoValidationError[] = [];
  const lines = content.split('\n');

  // Check syntax declaration
  let hasSyntax = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('syntax')) {
      hasSyntax = true;
      if (!/^syntax\s*=\s*"proto3"\s*;/.test(line)) {
        errors.push({ line: i + 1, column: 0, message: 'Invalid syntax declaration, should be: syntax = "proto3";' });
      }
      break;
    }
  }
  if (!hasSyntax) {
    errors.push({ line: 1, column: 0, message: 'Missing syntax declaration' });
  }

  // Check brace matching
  let braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') braceCount++;
      else if (ch === '}') {
        braceCount--;
        if (braceCount < 0) {
          errors.push({ line: i + 1, column: 0, message: "Unmatched closing brace '}'" });
        }
      }
    }
  }
  if (braceCount !== 0) {
    errors.push({ line: 0, column: 0, message: `Unmatched braces: ${braceCount} unclosed '{'` });
  }

  return errors;
}

function validateFieldTags(content: string): ProtoValidationError[] {
  const errors: ProtoValidationError[] = [];
  const lines = content.split('\n');
  const fieldPattern = /^\s*(optional|required|repeated)?\s*(\w+)\s+(\w+)\s*=\s*(\d+)\s*;/;
  const messageTagsMap = new Map<string, Set<number>>();
  let currentMessage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('message ')) {
      currentMessage = line
        .replace('message ', '')
        .replace(/\s*\{.*$/, '')
        .trim();
      messageTagsMap.set(currentMessage, new Set());
      continue;
    }
    if (line === '}') {
      currentMessage = '';
      continue;
    }

    const matches = line.match(fieldPattern);
    if (matches) {
      const tag = parseInt(matches[4], 10);

      if (tag < 1 || tag > 536870911) {
        errors.push({ line: i + 1, column: 0, message: `Field tag ${tag} is out of valid range (1-536870911)` });
      }
      if (tag >= 19000 && tag <= 19999) {
        errors.push({ line: i + 1, column: 0, message: `Field tag ${tag} is in reserved range (19000-19999)` });
      }
      if (currentMessage) {
        const tags = messageTagsMap.get(currentMessage)!;
        if (tags.has(tag)) {
          errors.push({ line: i + 1, column: 0, message: `Duplicate field tag ${tag} in message ${currentMessage}` });
        }
        tags.add(tag);
      }
    }
  }

  return errors;
}

function validateMessageNames(content: string): ProtoValidationError[] {
  const errors: ProtoValidationError[] = [];
  const lines = content.split('\n');
  const messagePattern = /^\s*message\s+(\w+)\s*\{/;
  const messageNames = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].match(messagePattern);
    if (matches) {
      const messageName = matches[1];

      if (!/^[A-Z][a-zA-Z0-9]*$/.test(messageName)) {
        errors.push({ line: i + 1, column: 0, message: `Message name '${messageName}' should be in PascalCase` });
      }

      const prevLine = messageNames.get(messageName);
      if (prevLine !== undefined) {
        errors.push({
          line: i + 1,
          column: 0,
          message: `Duplicate message name '${messageName}' (first defined at line ${prevLine})`,
        });
      }
      messageNames.set(messageName, i + 1);
    }
  }

  return errors;
}

function validateFieldNames(content: string): ProtoValidationError[] {
  const errors: ProtoValidationError[] = [];
  const lines = content.split('\n');
  const fieldPattern = /^\s*(optional|required|repeated)?\s*\w+\s+(\w+)\s*=\s*\d+\s*;/;

  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].match(fieldPattern);
    if (matches) {
      const fieldName = matches[2];
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldName)) {
        errors.push({ line: i + 1, column: 0, message: `Field name '${fieldName}' is not a valid identifier` });
      }
    }
  }

  return errors;
}

function validateDataTypes(content: string): ProtoValidationError[] {
  // Collect message names as valid types
  const validTypes = new Set([
    'double',
    'float',
    'int32',
    'int64',
    'uint32',
    'uint64',
    'sint32',
    'sint64',
    'fixed32',
    'fixed64',
    'sfixed32',
    'sfixed64',
    'bool',
    'string',
    'bytes',
  ]);

  const lines = content.split('\n');
  const messagePattern = /^\s*message\s+(\w+)\s*\{/;
  for (const line of lines) {
    const matches = line.match(messagePattern);
    if (matches) {
      validTypes.add(matches[1]);
    }
  }

  // No additional type errors reported (lenient, same as Go version)
  return [];
}
