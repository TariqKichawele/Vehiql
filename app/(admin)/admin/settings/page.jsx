import React from 'react'
import SettingsForm from '../_components/SettingsForm';

export const metadata = {
    title: "Settings | Vehiql Admin",
    description: "Manage dealership working hours and admin users",
};
  

const Settings = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <SettingsForm />
    </div>
  )
}

export default Settings