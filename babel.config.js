module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin은 내부적으로 react-native-worklets/plugin을
    // 그대로 재수출합니다(reanimated v4). 플러그인 배열의 마지막에 있어야 합니다.
    plugins: ['react-native-reanimated/plugin'],
  };
};
