
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
        '^.+\\.(css|sass|scss)$': 'identity-obj-proxy',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/tmp/'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
    },
};
