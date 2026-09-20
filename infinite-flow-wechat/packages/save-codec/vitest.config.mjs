const coreSource = new URL('../core/src/', import.meta.url).pathname;

export default {
  resolve: {
    alias: [
      {
        find: /^@infinite-flow\/core$/,
        replacement: `${coreSource}index.ts`
      },
      {
        find: /^@infinite-flow\/core\/(.+)$/,
        replacement: `${coreSource}$1.ts`
      }
    ]
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
};
