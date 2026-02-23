/// <reference types="vite/client" />

import type React from 'react';

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type IntrinsicElements = React.JSX.IntrinsicElements;
    type ElementType = React.JSX.ElementType;
  }
}
