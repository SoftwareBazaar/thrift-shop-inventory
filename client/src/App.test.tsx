import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('mounts without crashing and shows the loading state', () => {
  render(<App />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
