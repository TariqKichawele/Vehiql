'use server'

import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/prisma"

export async function getAdmin() {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: {
            clerkUserId: userId,
        },
    });

    if (!user || user.role !== "ADMIN") {
        return { authorized: false, reason: "not admin" };
    }

    return { authorized: true, user };
}

export async function getDashboardData() {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where: {
                clerkUserId: userId,
            },
        });

        if (!user || user.role !== "ADMIN") {
            return { authorized: false, reason: "not admin" };
        }

        const [cars, testDrives] = await Promise.all([
            db.car.findMany({
                select: {
                    id: true,
                    status: true,
                    featured: true,
                }
            }),

            db.testDriveBooking.findMany({
                select: {
                    id: true,
                    status: true,
                    carId: true
                }
            })
        ]);

        const totalCars = cars.length;
        const availableCars = cars.filter(car => car.status === "AVAILABLE").length;
        const unavailableCars = cars.filter(car => car.status === "UNAVAILABLE").length;
        const soldCars = cars.filter(car => car.status === "SOLD").length;
        const featuredCars = cars.filter(car => car.featured === true).length;

        const totalTestDrives = testDrives.length;
        const pendingTestDrives = testDrives.filter(
            (td) => td.status === "PENDING"
          ).length;
          const confirmedTestDrives = testDrives.filter(
            (td) => td.status === "CONFIRMED"
          ).length;
          const completedTestDrives = testDrives.filter(
            (td) => td.status === "COMPLETED"
          ).length;
          const cancelledTestDrives = testDrives.filter(
            (td) => td.status === "CANCELLED"
          ).length;
          const noShowTestDrives = testDrives.filter(
            (td) => td.status === "NO_SHOW"
          ).length;

         // Calculate test drive conversion rate
        const completedTestDriveCarIds = testDrives
        .filter((td) => td.status === "COMPLETED")
        .map((td) => td.carId);

        const soldCarsAfterTestDrive = cars.filter(
            (car) =>
            car.status === "SOLD" && completedTestDriveCarIds.includes(car.id)
        ).length;

        const conversionRate =
            completedTestDrives > 0
            ? (soldCarsAfterTestDrive / completedTestDrives) * 100
            : 0;

        return {
            success: true,
            data: {
                cars: {
                  total: totalCars,
                  available: availableCars,
                  sold: soldCars,
                  unavailable: unavailableCars,
                  featured: featuredCars,
                },
                testDrives: {
                  total: totalTestDrives,
                  pending: pendingTestDrives,
                  confirmed: confirmedTestDrives,
                  completed: completedTestDrives,
                  cancelled: cancelledTestDrives,
                  noShow: noShowTestDrives,
                  conversionRate: parseFloat(conversionRate.toFixed(2)),
                },
            },
        };
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        return {
            success: false,
            error: "Failed to fetch dashboard data",
        }
    }
}