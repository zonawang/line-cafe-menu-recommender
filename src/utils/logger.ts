type Metadata = Record<string, unknown>;

function write(level: 'info' | 'error', message: string, metadata?: Metadata) {
  const entry = {
    severity: level === 'error' ? 'ERROR' : 'INFO',
    message,
    ...metadata
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
    return;
  }

  console.log(output);
}

export const logger = {
  info(message: string, metadata?: Metadata) {
    write('info', message, metadata);
  },
  error(message: string, metadata?: Metadata) {
    write('error', message, metadata);
  }
};
