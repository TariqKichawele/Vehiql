import React from 'react'
import TestDrivesList from '../_components/TestDrivesList'

export const metadata = {
    title: "Test Drives | Vehiql Admin",
    description: "Manage test drive bookings",
};

const TestDrives = () => {
  return (
    <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Test Drive Management</h1>
        <TestDrivesList />
    </div>
  )
}

export default TestDrives