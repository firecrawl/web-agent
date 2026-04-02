module.exports = {
  plugins: {
    "postcss-import": {
      resolve(id) {
        return id.startsWith("@/") ? id.replace("@/", "./") : id;
      },
    },
    "tailwindcss/nesting": {},
    tailwindcss: {},
    autoprefixer: {},
    "postcss-nesting": {},
  },
};
