// module.exports = {
//     preset: 'ts-jest',
//     testEnvironment: 'node',
//     testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
//   };

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    testMatch: ['**/client/**/*.(test).[jt]s?(x)'],
  };