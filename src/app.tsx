import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';

export function startApp(options: {
  initialPrompt?: string;
  provider?: string;
  model?: string;
  autoRoute?: boolean;
  yolo?: boolean;
}) {
  render(
    <App
      initialPrompt={options.initialPrompt}
      provider={options.provider}
      model={options.model}
      autoRoute={options.autoRoute}
      yolo={options.yolo}
    />,
  );
}
