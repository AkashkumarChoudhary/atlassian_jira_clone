import type { Preview, Decorator } from '@storybook/nextjs-vite'
import '../src/app/globals.css'

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? 'light'
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="bg-background text-foreground min-h-24 p-6">
        <Story />
      </div>
    </div>
  )
}

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
  globalTypes: {
    theme: {
      description: 'Theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
}

export default preview
