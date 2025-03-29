"use server";

import { serializeCarData } from "@/lib/helpers";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getCarFilters() {
    try {
        const makes = await db.car.findMany({
            where: { status: "AVAILABLE" },
            select: { make: true },
            distinct: ["make"],
            orderBy: { make: "asc" }
        });

        const bodyTypes = await db.car.findMany({
            where: { status: "AVAILABLE" },
            select: { bodyType: true },
            distinct: ["bodyType"],
            orderBy: { bodyType: "asc" }
        });

        const fuelTypes = await db.car.findMany({
            where: { status: "AVAILABLE" },
            select: { fuelType: true },
            distinct: ["fuelType"],
            orderBy: { fuelType: "asc" },
        });
      
          // Get unique transmissions
        const transmissions = await db.car.findMany({
            where: { status: "AVAILABLE" },
            select: { transmission: true },
            distinct: ["transmission"],
            orderBy: { transmission: "asc" },
        });
      
          // Get min and max prices using Prisma aggregations
        const priceAggregations = await db.car.aggregate({
            where: { status: "AVAILABLE" },
            _min: { price: true },
            _max: { price: true },
        });

        return {
            success: true,
            data: {
                makes: makes.map((make) => make.make),
                bodyTypes: bodyTypes.map((bodyType) => bodyType.bodyType),
                fuelTypes: fuelTypes.map((fuelType) => fuelType.fuelType),
                transmissions: transmissions.map((transmission) => transmission.transmission),
                priceRange: {
                    min: priceAggregations._min.price
                        ? parseFloat(priceAggregations._min.price.toString())
                        : 0,
                    max: priceAggregations._max.price
                        ? parseFloat(priceAggregations._max.price.toString())
                        : 0
                }
            }
        }
    } catch (error) {
        throw new Error("Error fetching car filters:" + error.message);
    }
}

export async function getCars({
    search = "",
    make = "",
    bodyType = "",
    fuelType = "",
    transmission = "",
    minPrice = 0,
    maxPrice = Number.MAX_SAFE_INTEGER,
    sortBy = "newest", // Options: newest, priceAsc, priceDesc
    page = 1,
    limit = 6,
}) {
    try {
        const { userId } = await auth();
        let dbUser = null;

        if (userId) {
            dbUser = await db.user.findUnique({
                where: { clerkUserId: userId },
            });
        }

        let where = {
            status: "AVAILABLE",
        };

        if (search) {
            where.OR = [
                { make: { contains: search, mode: "insensitive" } },
                { model: { contains: search, mode: "insensitive" } },
                { color: { contains: search, mode: "insensitive" } },
            ]
        }

        if (make) where.make = { equals: make, mode: "insensitive" };
        if (bodyType) where.bodyType = { equals: bodyType, mode: "insensitive" };
        if (fuelType) where.fuelType = { equals: fuelType, mode: "insensitive" };
        if (transmission) where.transmission = { equals: transmission, mode: "insensitive" };

        where.price = {
            gte: parseFloat(minPrice) || 0,
        }

        if (maxPrice && maxPrice < Number.MAX_SAFE_INTEGER) {
            where.price.lte = parseFloat(maxPrice);
        }

        const skip = (page - 1) * limit;

        let orderBy = {}

        switch (sortBy) {
            case "priceAsc":
                orderBy = { price: "asc" };
                break;
            case "priceDesc":
                orderBy = { price: "desc" };
                break;
            case "newest":
            default:
                orderBy = { createdAt: "desc" };
                break;
        }

        const totalCars = await db.car.count({ where });

        const cars = await db.car.findMany({
            where,
            take: limit,
            skip,
            orderBy,
        });

        let wishlisted = new Set();
        if (dbUser) {
            const savedCars = await db.userSavedCar.findMany({
                where: { userId: dbUser.id },
                select: { carId: true },
            });

            wishlisted = new Set(savedCars.map((car) => car.carId));
        }

        const serializedCars = cars.map((car) => serializeCarData(car, wishlisted.has(car.id)));

        return {
            success: true,
            data: serializedCars,
            pagination: {
                total: totalCars,
                page,
                limit,
                pages: Math.ceil(totalCars / limit),
            }
        }
    } catch (error) {
        throw new Error("Error fetching cars:" + error.message);
    }
}

export async function getCarById(carId) {
    try {
        const { userId } = await auth();
        let dbUser = null;

        if (userId) {
            dbUser = await db.user.findUnique({
                where: { clerkUserId: userId },
            });
        }

        const car = await db.car.findUnique({
            where: {
                id: carId,
            },
        });

        if (!car) {
            return {
                success: false,
                error: "Car not found",
            }
        }

        let isWishlisted = false;
        if (dbUser) {
            const savedCar = await db.userSavedCar.findUnique({
                where: {
                    userId_carId: {
                        userId: dbUser.id,
                        carId: car.id,
                    },
                },
            });

            isWishlisted = !!savedCar;
        }

        const existingTestDrive = await db.testDriveBooking.findFirst({
            where: {
                carId,
                userId: dbUser?.id,
                status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        let userTestDrive = null;

        if (existingTestDrive) {
            userTestDrive = {
                id: existingTestDrive.id,
                status: existingTestDrive.status,
                bookingDate: existingTestDrive.bookingDate.toISOString()
            }
        }

        const dealership = await db.dealershipInfo.findFirst({
            include: {
                workingHours: true
            }
        });

        return {
            success: true,
            data: {
                ...serializeCarData(car, isWishlisted),
                testDriveInfo: {
                    userTestDrive,
                    dealership: dealership
                       ? {
                            ...dealership,
                            createdAt: dealership.createdAt?.toISOString(),
                            updatedAt: dealership.updatedAt?.toISOString(),
                            workingHours: dealership.workingHours.map((hour) => ({
                                ...hour,
                                createdAt: hour.createdAt?.toISOString(),
                                updatedAt: hour.updatedAt?.toISOString(),
                            })),
                        }
                       : null   
                }
            }
        }
    } catch (error) {
        throw new Error("Error fetching car:" + error.message);
    }
}

export async function toggleSavedCar(carId) {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });
        if (!user) throw new Error("User not found");


        const car = await db.car.findUnique({
            where: { id: carId },
        });
        if (!car) throw new Error("Car not found");
    

        const existingSavedCar = await db.userSavedCar.findUnique({
            where: {
                userId_carId: {
                    userId: user.id,
                    carId
                },
            },
        });

        if (existingSavedCar) {
            await db.userSavedCar.delete({
                where: {
                    userId_carId: {
                        userId: user.id,
                        carId
                    },
                },
            });

            revalidatePath("/saved-cars");
            return {
                success: true,
                message: "Car removed from saved cars",
                saved: false
            }
        }

        await db.userSavedCar.create({
            data: {
                userId: user.id,
                carId
            },
        });

        revalidatePath("/saved-cars");
        return {
            success: true,
            message: "Car added to saved cars",
            saved: true
        }
    } catch (error) {
        throw new Error("Error toggling saved car:" + error.message);
    }
}

export async function getSavedCars() {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where: { clerkUserId: userId },
        });
        if (!user) throw new Error("User not found");

        const savedCars = await db.userSavedCar.findMany({
            where: { userId: user.id },
            include: {
                car: true
            },
            orderBy: { savedAt: "desc" }
        });
        const cars = savedCars.map((saved) => serializeCarData(saved.car));

        return {
            success: true,
            data: cars
        }
    } catch (error) {
        console.error("Error fetching saved cars:", error);
        return {
            success: false,
            error: "Failed to fetch saved cars"
        }
    }
}