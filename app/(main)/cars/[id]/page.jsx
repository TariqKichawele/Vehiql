import { getCarById } from '@/actions/car-listing';
import { notFound } from 'next/navigation';
import React from 'react'

const Car = async ({ params }) => {
    const { id } = params;
    const result = await getCarById(id);

    if (!result.success) {
        notFound();
    }
    
  return (
    <div>Car</div>
  )
}

export default Car