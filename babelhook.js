require("babel/register")({
  comments: true,
  compact: false,
  blacklist: [
    'spec.functionName',
  ],
  optional: [
    'es7.trailingFunctionCommas',
  ]
});