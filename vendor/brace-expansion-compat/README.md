# brace-expansion compatibility adapter

ESLint 9의 일부 플러그인은 `minimatch@3`을 통해 `brace-expansion`의 예전
CommonJS 함수 export를 사용한다. 보안 수정판 `brace-expansion@5.0.8`은
`expand`라는 named export를 제공하므로 이 어댑터가 두 형식을 함께 노출한다.
루트 `package.json`의 `$brace-expansion` override 참조를 통해서만
`minimatch@3`의 `brace-expansion` 슬롯을 대체한다.

`eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`가
`minimatch@3` 의존성을 제거하면 이 디렉터리와 관련 override 및 npm alias를
함께 삭제한다.
