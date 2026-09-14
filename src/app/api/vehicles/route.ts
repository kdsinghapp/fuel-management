import { NextRequest, NextResponse } from 'next/server';
import { getSqlPool, sql } from '@/lib/azureSql';

// GET: Fetch all vehicles or a single vehicle by id / search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');
    const department = searchParams.get('department');
    const status = searchParams.get('status');

    const pool = await getSqlPool();
    const req = pool.request();

    let query = 'SELECT * FROM dbo.VehicleDetails WHERE 1=1';

    if (id) {
      req.input('id', sql.Int, parseInt(id, 10));
      query += ' AND VehicleId = @id';
    }

    if (search) {
      req.input('search', sql.NVarChar(100), `%${search}%`);
      query += ' AND (Asset LIKE @search OR FleetId LIKE @search OR Make LIKE @search OR Model LIKE @search)';
    }

    if (department) {
      req.input('department', sql.NVarChar(100), department);
      query += ' AND Department = @department';
    }

    if (status) {
      req.input('status', sql.NVarChar(20), status);
      query += ' AND Status = @status';
    }

    query += ' ORDER BY VehicleId DESC';

    const result = await req.query(query);

    return NextResponse.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
    });
  } catch (error: any) {
    console.error('API Error in GET /api/vehicles:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Add a new vehicle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      Asset,
      FleetId,
      Department,
      VehicleYear,
      Make,
      Model,
      VehicleClass,
      ModeOfUse,
      MonthlyMileageAllowanceKm,
      BurnRateLPer100Km,
      FuelLimitLitres,
      StandardBurnRate,
      Status = 'Active',
      CreatedBy = 'Admin',
    } = body;

    if (!Asset) {
      return NextResponse.json(
        { success: false, message: 'Asset name is required.' },
        { status: 400 }
      );
    }

    const pool = await getSqlPool();
    const req = pool.request();

    req.input('Asset', sql.NVarChar(100), Asset);
    req.input('FleetId', sql.NVarChar(50), FleetId || null);
    req.input('Department', sql.NVarChar(100), Department || null);
    req.input('VehicleYear', sql.Int, VehicleYear ? parseInt(VehicleYear, 10) : null);
    req.input('Make', sql.NVarChar(100), Make || null);
    req.input('Model', sql.NVarChar(100), Model || null);
    req.input('VehicleClass', sql.NVarChar(100), VehicleClass || null);
    req.input('ModeOfUse', sql.NVarChar(100), ModeOfUse || null);
    req.input('MonthlyMileageAllowanceKm', sql.Decimal(18, 2), MonthlyMileageAllowanceKm ? parseFloat(MonthlyMileageAllowanceKm) : null);
    req.input('BurnRateLPer100Km', sql.Decimal(18, 2), BurnRateLPer100Km ? parseFloat(BurnRateLPer100Km) : null);
    req.input('FuelLimitLitres', sql.Decimal(18, 2), FuelLimitLitres ? parseFloat(FuelLimitLitres) : null);
    req.input('StandardBurnRate', sql.Decimal(18, 2), StandardBurnRate ? parseFloat(StandardBurnRate) : null);
    req.input('Status', sql.NVarChar(20), Status);
    req.input('CreatedBy', sql.NVarChar(100), CreatedBy || 'Admin');

    const insertQuery = `
      INSERT INTO dbo.VehicleDetails (
        Asset, FleetId, Department, VehicleYear, Make, Model,
        VehicleClass, ModeOfUse, MonthlyMileageAllowanceKm,
        BurnRateLPer100Km, FuelLimitLitres, StandardBurnRate,
        Status, CreatedAt, CreatedBy
      )
      OUTPUT INSERTED.*
      VALUES (
        @Asset, @FleetId, @Department, @VehicleYear, @Make, @Model,
        @VehicleClass, @ModeOfUse, @MonthlyMileageAllowanceKm,
        @BurnRateLPer100Km, @FuelLimitLitres, @StandardBurnRate,
        @Status, SYSUTCDATETIME(), @CreatedBy
      )
    `;

    const result = await req.query(insertQuery);

    return NextResponse.json({
      success: true,
      message: 'Vehicle added successfully.',
      data: result.recordset[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('API Error in POST /api/vehicles:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT: Update vehicle details
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      VehicleId,
      Asset,
      FleetId,
      Department,
      VehicleYear,
      Make,
      Model,
      VehicleClass,
      ModeOfUse,
      MonthlyMileageAllowanceKm,
      BurnRateLPer100Km,
      FuelLimitLitres,
      StandardBurnRate,
      Status,
      UpdatedBy = 'Admin',
    } = body;

    if (!VehicleId) {
      return NextResponse.json(
        { success: false, message: 'VehicleId is required for update.' },
        { status: 400 }
      );
    }

    const pool = await getSqlPool();
    const req = pool.request();

    req.input('VehicleId', sql.Int, parseInt(VehicleId, 10));
    req.input('Asset', sql.NVarChar(100), Asset);
    req.input('FleetId', sql.NVarChar(50), FleetId || null);
    req.input('Department', sql.NVarChar(100), Department || null);
    req.input('VehicleYear', sql.Int, VehicleYear ? parseInt(VehicleYear, 10) : null);
    req.input('Make', sql.NVarChar(100), Make || null);
    req.input('Model', sql.NVarChar(100), Model || null);
    req.input('VehicleClass', sql.NVarChar(100), VehicleClass || null);
    req.input('ModeOfUse', sql.NVarChar(100), ModeOfUse || null);
    req.input('MonthlyMileageAllowanceKm', sql.Decimal(18, 2), MonthlyMileageAllowanceKm ? parseFloat(MonthlyMileageAllowanceKm) : null);
    req.input('BurnRateLPer100Km', sql.Decimal(18, 2), BurnRateLPer100Km ? parseFloat(BurnRateLPer100Km) : null);
    req.input('FuelLimitLitres', sql.Decimal(18, 2), FuelLimitLitres ? parseFloat(FuelLimitLitres) : null);
    req.input('StandardBurnRate', sql.Decimal(18, 2), StandardBurnRate ? parseFloat(StandardBurnRate) : null);
    req.input('Status', sql.NVarChar(20), Status || 'Active');
    req.input('UpdatedBy', sql.NVarChar(100), UpdatedBy || 'Admin');

    const updateQuery = `
      UPDATE dbo.VehicleDetails
      SET 
        Asset = @Asset,
        FleetId = @FleetId,
        Department = @Department,
        VehicleYear = @VehicleYear,
        Make = @Make,
        Model = @Model,
        VehicleClass = @VehicleClass,
        ModeOfUse = @ModeOfUse,
        MonthlyMileageAllowanceKm = @MonthlyMileageAllowanceKm,
        BurnRateLPer100Km = @BurnRateLPer100Km,
        FuelLimitLitres = @FuelLimitLitres,
        StandardBurnRate = @StandardBurnRate,
        Status = @Status,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedBy = @UpdatedBy
      OUTPUT INSERTED.*
      WHERE VehicleId = @VehicleId
    `;

    const result = await req.query(updateQuery);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: `Vehicle with ID ${VehicleId} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Vehicle updated successfully.',
      data: result.recordset[0],
    });
  } catch (error: any) {
    console.error('API Error in PUT /api/vehicles:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove vehicle by VehicleId
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Vehicle id is required.' },
        { status: 400 }
      );
    }

    const pool = await getSqlPool();
    const req = pool.request();
    req.input('id', sql.Int, parseInt(id, 10));

    const deleteQuery = `DELETE FROM dbo.VehicleDetails WHERE VehicleId = @id`;
    const result = await req.query(deleteQuery);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json(
        { success: false, message: `Vehicle with ID ${id} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Vehicle ${id} deleted successfully.`,
    });
  } catch (error: any) {
    console.error('API Error in DELETE /api/vehicles:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
