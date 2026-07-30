import { Redirect } from 'expo-router';

/** Backing route for the tab bar's center slot. The slot's tabBarButton
 * (components/ui/center-fab-button.tsx) never actually navigates here — it
 * opens the create action sheet instead. This redirect is just a safety net
 * in case navigation reaches this route some other way. */
export default function CreateTabPlaceholder() {
  return <Redirect href="/" />;
}
